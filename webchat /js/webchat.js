Chat = {
	login_name : null,
	menu_click : null,
	origin : "http://192.168.4.189:8000",
	progress_bar : '<div class="progress progress-info progress-striped active" style="width: 300px;height: 25px;margin: auto; margin-top:150px;"><div id="progress-bar" class="bar" style="width: 0%;"></div></div>',
	hall : '<ul id="chat-tab" class="nav nav-tabs"><li id="tab_channel_0" class="active"><a href="#channel_0" data-toggle="tab">大厅</a></li></ul>',
	Login_Input : function() {
		if (window.localStorage.username) {
			$('#page_login input#username').val(window.localStorage.username);
		}
	},
	Get_Username : function() {
		return Chat.login_name;
	},
	Show_Username : function(username) {
		$('#top-btn > #top-btn-inner > span').text(username);
		$('#alert-setting').before('<li><a href="javascript:Chat.menu_click=\'add_channel\';Chat.Top_Menu();">进入频道</a></li><li><a href="javascript:Chat.menu_click=\'chat_user\';Chat.Top_Menu();">查找用户</a></li>');
	},
	Body_Re : function() {
		$('body').attr({
			onBeforeUnload : 'return "聊聊天，喝喝茶";',
			onUnload : 'Socket.closeSocket();return false;'
		});
	},
	ShowConfirmClose : function(e) {
		if (!e) {
			e = e || window.event;
		}
		if (e.keyCode == '27') {
			//Esc
			e.preventDefault();
			window.location = Chat.origin;
		}
	},
	Hide_Progress : function(id) {
		$('#' + id).hide();
	},
	Show_Progress : function(id, time, callback) {
		$('#' + id).show();
		$('#' + id).html(Chat.progress_bar);
		window.sessionStorage.zhouqi = time * 1000 / 100;
		window.sessionStorage.addTo = 1;
		var bar = window.setInterval(function() {
			$('#progress-bar').css({
				'width' : window.sessionStorage.addTo + '%'
			});
			window.sessionStorage.addTo = Number(window.sessionStorage.addTo) + 1;
			if (Number(window.sessionStorage.addTo) >= 101) {
				clearInterval(bar);
				//alert("clear");
				callback();
			}
		}, window.sessionStorage.zhouqi);
	},
	Login_ok : function() {
		//e.preventDefault();
		Chat.login_name = $('#page_login > #form-center > #username').val();
		window.localStorage.username = Chat.login_name;
		document.cookie = "username=%" + Chat.login_name + "%";
		//alert(window.sessionStorage.username);
		$.get('chat.html', function(html) {
			window.sessionStorage.chat_html = html;
			//console.log(window.sessionStorage.chat_html);
		});
		Chat.Show_Progress('base-main', 2, function() {
			Chat.Hide_Progress('base-main');
			$('#top-head .container').html(Chat.hall);
			$('#base-main').before(window.sessionStorage.chat_html);
			Socket.Connect();
			Chat.Body_Re();
			Chat.Show_Username(Chat.Get_Username());
			Socket.Init();
		});
		//Chat.Show_Progress('base-main',10,function(){});
	},
	Top_Menu : function() {
		switch(Chat.menu_click) {
			case "add_channel":
				Chat.Show_Modal('填写频道名称', '<input type="text" id="channelname" class="input-xlarge" placeholder="频道名" maxlength="10" required onkeydown="e = window.event;if (e.which == 13 || e.which == 10) {e.preventDefault();Chat.Click_Menu();}" />');
				break;
			case 'chat_user':
				Socket.socket.send(window.JSON.stringify({'channel':'大厅','username':Chat.Get_Username(),'message':'show_users','status':'5'}));
				var users = '';
				for (var i = 0; i < Channel.data_users.length; i++) {
					users += '<option>' + Channel.data_users[i] + '</option>';
				}
				Chat.Show_Modal('选择在线用户', '<select id="multiSelect" multiple="multiple">' + users + '</select>');
				break;
			default:
				break;
		}
	},
	Click_Menu : function() {
		switch(Chat.menu_click) {
			case "add_channel":
				var channelname = $('input#channelname').val();
				if (channelname != '') {
					Channel.New(Chat.Get_Username(), channelname);
					$('#modal-alert').modal('hide');
				} else {
					alert('未填写频道名');
				}
				break;
			case 'chat_user':
				var username = $('select#multiSelect').val()[0];
				if (!username) {
					alert('未选择用户');
				} else if (username == Chat.Get_Username()) {
					alert('不能选择自己');
				} else {
					//Channel.Show_User(Channel.Add(username));
					//Socket.AddMsg($('#user-channel'),'我对 '+username+' 说 > ');
					$('#send-msg').val('@ ' + username + ' : ');
					$('#modal-alert').modal('hide');
				}
				break;
			default:
				break;
		}
	},
	Show_Modal : function(title, content) {
		$('#modal-alert .modal-header h3').text(title);
		$('#modal-alert .modal-body p').html(content);
		$('#modal-alert').modal('show');
	},
};
Socket = {
	socket : null,
	addressBox : null,
	username : null,
	messageBox : null,
	showBox : null,
	Init : function() {
		Socket.username = Chat.Get_Username();
		Socket.showBox = $('#' + Channel.channel_data[0].channel_id + '.chat-channel');
		Socket.messageBox = $('#send-msg');
		document.onkeydown = Chat.ShowConfirmClose;
		/*$(document).keypress(function(e) {
		 Chat.ShowConfirmClose(e);
		 });*/
		window.sessionStorage.islogin = true;
	},
	Connect : function() {
		var scheme = window.location.protocol == 'https:' ? 'wss://' : 'ws://';
		Socket.addressBox = scheme + window.location.host + '/echo';
		with (Socket) {
			if ('WebSocket' in window) {
				socket = new WebSocket(addressBox);
			} else if ('MozWebSocket' in window) {
				socket = new MozWebSocket(addressBox);
			} else {
				return;
			}
			socket.onopen = function() {
				//AddMsg(showBox, username+' > 进入大厅');
				/*var Heart = setInterval(function() {
				 socket.send("{'username':'" + username + "','message':'Heartbeat','status':'2'}");
				 }, 60000);*/
				socket.send(window.JSON.stringify({'channel':'大厅','username':username,'message':'进入大厅','status':'0'}));
				socket.send(window.JSON.stringify({'channel':'大厅','username':Chat.Get_Username(),'message':'show_users','status':'5'}));
				setInterval(function() {
					socket.send(window.JSON.stringify({'channel':'大厅','username': Chat.Get_Username(),'message':'show_users','status':'5'}));
				}, 10000);
			};
			socket.onmessage = function(event) {
				var mydata = eval("(" + event.data + ")");
				var name = mydata.username;
				var user_msg = mydata.message;
				var status = Number(mydata.status);
				var channel = mydata.channel;
				var seq = Channel.Search(channel);
				showBox = $('#' + Channel.channel_data[seq].channel_id + '.chat-channel');
				if (status == 3) {
					if (name == username) {
						Channel.Show(Channel.Add(channel));
					} else {
						AddMsg(showBox, name + ' > ' + user_msg);
					}
				} else if (status == 5) {
					if (channel == '大厅') {
						Channel.data_users = user_msg;
						//console.log(user_msg);
					} else {
						AddMsg($('#user-channel'), '@ ' + name + ' 对你说 > ' + user_msg);
					}
				} else {
					AddMsg(showBox, name + ' > ' + user_msg);
				}
			};
			socket.onerror = function() {
				AddMsg(showBox, '昵称已被使用或网络连接失败！');
			};
			socket.onclose = function(event) {
				//clearInterval(Heart);
				var logMessage = 'Closed (';
				if ((arguments.length == 1) && ('CloseEvent' in window) && ( event instanceof CloseEvent)) {
					logMessage += 'wasClean = ' + event.wasClean;
					// code and reason are present only for
					// draft-ietf-hybi-thewebsocketprotocol-06 and later
					if ('code' in event) {
						logMessage += ', code = ' + event.code;
					}
					if ('reason' in event) {
						logMessage += ', reason = ' + event.reason;
					}
				} else {
					logMessage += 'CloseEvent is not available';
				}
				//AddMsg(showBox, logMessage + ')');
				//AddMsg(showBox, username + ' > 退出大厅');
				window.location = Chat.origin;
			};
		}
	},
	send : function() {
		with (Socket) {
			if (!socket) {
				AddMsg(showBox, 'Not connected');
				return;
			}
			messageBox.val(messageBox.val().replace(/[\r\n]/g, " "));
			var msg = messageBox.val();
			var status = Channel.get_status(msg);
			socket.send(window.JSON.stringify({'channel':Channel.get_active_tab(),'username': username ,'message': msg ,'status':status }));
			if (status == '5') {
				Socket.AddMsg($('#user-channel'), '我  > ' + msg);
			}
			//addToLog(' 我 > ' + messageBox.value);
			messageBox.val('');
		}
	},
	closeSocket : function() {
		with (Socket) {
			if (!socket) {
				AddMsg(showBox, 'Not connected');
				return;
			}
			Channel.All_Close();
			socket.close();
		}
	},
	Keycatch : function(e) {
		if (!e)
			e = e || window.event;
		if (e.which == 13 || e.which == 10) {
			e.preventDefault();
			Socket.send();
		}
	},
	AddMsg : function(box, msg) {
		//box.contents()获得全部子内容
		var tmp_msg = msg + '<br/>';
		box.append(tmp_msg);
		box[0].scrollTop = box[0].scrollHeight;
	},
};
Channel = {
	channel_data : [{
		'channel_id' : 'channel_0',
		'channel_name' : '大厅'
	}],
	data_clear : [],
	data_users : [],
	data_position : function(way, data) {
		data = data | '';
		if (way == "add") {
			if (Channel.data_clear.length == 0) {
				var seq = Channel.channel_data.length;
				Channel.channel_data.push('');
				return seq;
			} else {
				return Channel.data_clear.pop();
			}
		} else if (way == "del") {
			for (var i = 1; i < Channel.channel_data.length; i++) {
				if (Channel.channel_data[i].channel_name == data) {
					Channel.channel_data[i].channel_id = '';
					Channel.data_clear.push(i);
				}
			}
		}
		return '';
	},
	get_active_tab : function() {
		var tmp = $('#chat-tab > li.active > a').text();
		if (tmp.slice(0, 1) == '#' || tmp.slice(0, 1) == '@') {
			tmp = tmp.slice(2);
		}
		if (tmp.slice(-1) == '×') {
			return tmp.slice(0, -1);
		}
		return tmp;
	},
	get_status : function(msg) {
		if (msg.slice(0, 1) == '@') {
			return '5';
		} else {
			return '0';
		}
	},
	channel_tab : function(seq) {
		return '<li id="tab_' + Channel.channel_data[seq].channel_id + '" class=""><a href="#' + Channel.channel_data[seq].channel_id + '" data-toggle="tab"># ' + Channel.channel_data[seq].channel_name + '<span class="close" onclick="Channel.Close(this);">&times;</span></a></li>';
	},
	user_tab : function(seq) {
		return '<li id="tab_' + Channel.channel_data[seq].channel_id + '" class=""><a href="#' + Channel.channel_data[seq].channel_id + '" data-toggle="tab">@ ' + Channel.channel_data[seq].channel_name + '<span class="close">&times;</span></a></li>';
	},
	channel_content : function(seq) {
		return '<div id="' + Channel.channel_data[seq].channel_id + '" class="tab-pane input-xlarge chat-channel" readonly="readonly" style="z-index:' + seq + '"></div>';
	},
	New : function(username, channel_name) {
		Socket.socket.send(window.JSON.stringify({'channel':'大厅','username': username ,'message':channel_name,'status':'3'}));
	},
	Search : function(channel_name) {
		for (var i = 0; i < Channel.channel_data.length; i++) {
			if (Channel.channel_data[i].channel_name == channel_name) {
				return i;
			}
		}
		return 0;
	},
	Add : function(channel_name) {
		var seq = Channel.data_position('add');
		var new_channel = {};
		new_channel['channel_id'] = 'channel_' + seq;
		new_channel['channel_name'] = channel_name;
		Channel.channel_data[seq] = new_channel;
		return seq;
	},
	Show : function(seq) {
		$('ul#chat-tab').append(Channel.channel_tab(seq));
		$('#channel-show').append(Channel.channel_content(seq));
		$('#chat-tab > li:last > a').trigger('click');
	},
	Show_User : function(seq) {
		$('ul#chat-tab').append(Channel.user_tab(seq));
		$('#channel-show').append(Channel.channel_content(seq));
		$('#chat-tab > li:last > a').trigger('click');
	},
	Close : function(mydom) {
		var channel_a = $(mydom).parent('a');
		var channel_name = channel_a.text().slice(2, -1);
		Socket.socket.send(window.JSON.stringify({'channel': channel_name ,'username': Socket.username,'message':'退出 #','status':'4'}));
		channel_a.parent('li').remove();
		Channel.data_position('del', channel_name);
		$('#chat-tab > li:last > a').trigger('click');
	},
	All_Close : function() {
		var tab_num = $('#chat-tab li').length - 1;
		for (tab_num; tab_num > 0; tab_num--) {
			//$('#chat-tab li').eq(tab_num).find('.close').trigger('click');
			Socket.socket.send(window.JSON.stringify({'channel':Channel.channel_data[tab_num]['channel_name'] ,'username':Socket.username,'message':'退出 #','status':'4'}));
		}
	},
}; 