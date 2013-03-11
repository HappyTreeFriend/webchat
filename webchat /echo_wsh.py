#!/usr/bin/env python
#coding:utf-8

from mod_pywebsocket import *
import xml.sax.saxutils as saxutils
import thread,socket
import threading,random
import getopt,time,copy
import os,sys
import json,struct,hashlib


#request._request_handler.headers.getheader('Cookie')
#'sessionid=cb09131b6007e05195b90ee84a4c23f2; csrftoken=3OOmgfICNRcUulKbyYrfdxmY3xyamYhY; username=123'

_GOODBYE_MESSAGE = 'Goodbye'
_HEARTBEAT_ = 'Heartbeat'

class CHANNEL():
	def __init__(self):
		'''self.channel = {'channel_name':['username1',...],...}'''
		self.channel = {'大厅':[]}
	def add_channel(self,username,channel_name):
		if self.channel.has_key(channel_name):
			pass
		else:
			self.channel[channel_name] = []
		return self.add_client(username,channel_name)
	def rm_channel(self,channel_name):
		self.channel.pop(channel_name)
	def add_client(self,username,channel_name):
		if username not in self.channel[channel_name]:
			self.channel[channel_name].append(username)
			return channel_name
		else:
			return False
	def rm_client(self,username,channel_name):
		self.channel[channel_name].remove(username)
		if channel_name != '大厅':
			if len(self.channel[channel_name]) == 0:
				self.rm_channel(channel_name)
	def re_channel_user(self,channel_name):
		if channel_name in self.channel.keys():
			return self.channel[channel_name]
		else:
			return []
	def re_hall_req(self,client):
		return self.re_channel_req('大厅',client)
	def re_channel_req(self,channel_name,client):
		tmp_channel = []
		for name in self.re_channel_user(channel_name):
			tmp_channel.append(client.re_req(name))
		return tmp_channel

class CLIENT():
	def __init__(self):
		'''self.client = {'username':request,...}'''
		self.client = {}
		#self.allow_origin = 'http://127.0.0.1:8000'
		self.allow_origin = 'http://192.168.4.189:8000'
	def is_has(self,key):
		return self.client.has_key(key)
	def add(self,name,req):
		self.client[name] = req
	def re_req(self,name):
		return self.client.get(name)
	def rm_c(self,name):
		self.client.pop(name)
	def re_names(self):
		return self.client.keys()
	def re_name(self,req):
		for k in self.re_names():
			if self.client[k] == req:
				return k
		return None

class REQUEST():
	def __init__(self,request):
		self.request = request
	def get_username(self):
		return str(self.request._request_handler.headers.getheader('Cookie')).replace(' ','').split('%')[1]
	def get_origin(self):
		return self.request.ws_origin

class DATA():
	def __init__(self, data):
		self.data = data
	def utf2html(self):
		for (k, v) in self.data.items():
			self.data[k] = saxutils.escape(self.data[k])
		return self.data
	def json2dict(self):
		dict_data = json.loads(self.data)
		tmp_dict = {}
		for (v,k) in dict_data.items():
			tmp_dict[v.encode('utf-8')] = k.encode('utf')
		return tmp_dict
	def utf2unicode(self):
		return unicode(self.data,'utf-8')

class MESSAGE():
	def __init__(self,dict_msg):
		self.channel = dict_msg['channel']
		self.username = dict_msg['username']
		self.message = dict_msg['message']
		self.status = dict_msg['status']
	def sendFormat(self):
		return DATA("{'channel':'"+self.channel+"','username':'"+self.username+"','message':'"+self.message+"','status':'"+self.status+"'}").utf2unicode()
	def userFormat(self):
		return DATA("{'channel':'"+self.channel+"','username':'"+self.username+"','message':"+self.message+",'status':'"+self.status+"'}").utf2unicode()



chat_channel = CHANNEL()
chat_client = CLIENT()

def send_msg_hall(msg):
	global chat_client
	hall_msg = copy.deepcopy(msg)
	hall_msg.channel = '大厅'
	hall_msg.status = '0'
	for c in chat_channel.re_hall_req(chat_client):
		c.ws_stream.send_message(hall_msg.sendFormat(), binary=False)

def web_socket_do_extra_handshake(request):
	'''
	判断是否已有用户名,禁止跨域访问
	加入大厅的客户端
	'''
	global chat_client,chat_channel	
	print "当前连接\n",chat_client.client,chat_channel.channel
	req = REQUEST(request)
	username = saxutils.escape(req.get_username()[:10])
	if req.get_origin() == chat_client.allow_origin and not(chat_client.is_has(username)):
		chat_client.add(username,request)
		chat_channel.add_client(username,'大厅')
		return
	raise ValueError('Unacceptable origin: %r' % request.ws_origin)

def web_socket_transfer_data(request):
	'''
	处理数据
		判断状态
		0：全部客户端发送(大厅广播消息)
		1：
		2：全部客户端不发送(心跳)
		3：进入频道
		4：退出频道
		5：私聊操作
	'''
	global chat_client,chat_channel
	while True:
		try:
			msg = request.ws_stream.receive_message()
			if msg is None:
				return
			#将传递过来的字符串转换成字典dict_line
			msg = MESSAGE(DATA(DATA(msg).json2dict()).utf2html())
			if msg.status == '3':
				#选择或创建频道,并将客户端加入	
				msg.channel = msg.message[:10]
				msg.message = '进入 #' + msg.message
				if not(chat_channel.add_channel(msg.username,msg.channel)):
					tmp_channel = []
				else:
					tmp_channel = chat_channel.re_channel_req(msg.channel,chat_client)
				#往大厅发送进入频道消息
				if len(tmp_channel)!=0:
					send_msg_hall(msg)
				for c in tmp_channel:
					c.ws_stream.send_message(msg.sendFormat(), binary=False)
				continue 
			if msg.status == '2':
				#客户端心跳
				continue
			elif msg.status == '4':
				msg.message = msg.message+msg.channel
				chat_channel.rm_client(msg.username,msg.channel)
				send_msg_hall(msg)
			elif msg.status == '5':
				if msg.message == 'show_users':
					msg.message = str(chat_client.re_names())
					request.ws_stream.send_message(msg.userFormat(),binary=False)
				else:
					tmp_msg = msg.message.split(' : ')
					msg.channel = tmp_msg[0][2:]
					msg.message = tmp_msg[1]
					call_user = chat_client.re_req(msg.channel)
					if not(call_user):
						#用户已下线
						msg.message = msg.channel+' 已经退出'
						msg.status = '5'
						request.ws_stream.send_message(msg.sendFormat(),binary=False)
					else:
						#request.ws_stream.send_message(msg.sendFormat(),binary=False)
						call_user.ws_stream.send_message(msg.sendFormat(),binary=False)
				continue
			#发送消息
			tmp_channel = chat_channel.re_channel_req(msg.channel,chat_client)
			for c in tmp_channel:
				c.ws_stream.send_message(msg.sendFormat(), binary=False)
		except:
			msg.username = "系统"
			msg.message = "请不要发送奇怪的字符哦"
			msg.status = '0'
			request.ws_stream.send_message(msg.sendFormat(),binary=False)
            

def web_socket_passive_closing_handshake(request):
	'''
	删除退出大厅的客户端
	'''
	global chat_client,chat_channel
	code = 1001
	reason = _GOODBYE_MESSAGE
	username = chat_client.re_name(request)
	chat_channel.rm_client(username,'大厅')
	chat_client.rm_c(username)
	msg = MESSAGE({'channel':'大厅','username':username,'message':'退出大厅','status':'0'})
	send_msg_hall(msg)
	print "退出之后\n",chat_client.client,chat_channel.channel
	return code, reason
