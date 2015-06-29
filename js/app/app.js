/**
 * Created by krm11 on 24-08-2014.
 *
 * @author: Pankaj Soni <pankajsoni@softwarejoint.com>
 *
 * Copyright 2015-2016 Software Joint Pvt Ltd
 */

function getYowzaConn(){
    var root = {};

    root.user = null;
    root.toSendQ = [];
    root.friends = null;
	root.resendTimer = null;
    root.connectionState = CONNECTION_STATE.NOT_CONNECTED;
    root.onConnectedCallback = null;
    root.pushOnLogin = [];
    root.customHandler = [];

    root.addCustomHandler = function(MsgType, onResponseCallback){
        root.customHandler.push({type: MsgType, onResponseCallback: onResponseCallback});
    };

    root.addtoPushOnLogin = function(onLoginCallback){
        root.pushOnLogin.push(onLoginCallback);
    };

    root._onopen = function(){
        console.log('New Connection established.');
        root.connectionState = CONNECTION_STATE.CONNECTED;
        if(root.onConnectedCallback){
            root.onConnectedCallback();
        }
    };

    root._onerror = function(error){
        console.error('WebSocket Error: ');
        console.error(error);
        if(root.ws && (root.ws.readyState == WebSocket.CONNECTING || root.ws.readyState == WebSocket.OPEN)){
            root.ws.close();
        }
        root._onclose(error);
        root.check_ws(false);
    };

    root._onclose = function(reason) {
        console.log('WebSocket Closed because:');
        console.log(reason);
        root.ws = null;
        root.connectionState = CONNECTION_STATE.NOT_CONNECTED;
        root.user = null;
        root.friends = null;
        if(root.resendTimer){
            clearTimeout(root.resendTimer);
            root.resendTimer = null;
        }
    };

    root._onmessage = function(msg){
		if(typeof msg.data != "string"){
			return;
		}
		
        var json = JSON.parse(msg.data);
        var b = root.toSendQ;
        root.toSendQ = [];
        var jSent = null;
        $.each(b, function(index, jinQ){
           if(jinQ.id != json.id){
               root.toSendQ.push(jinQ);
           }

            if(jinQ.id == json.id){
                jSent = jinQ;
            }
        });

        if(json.ack){
            root.sendAckJson(json.id);
        }

        root.processIncomingJson(json, jSent);

        if(jSent && jSent.onResponseCallback){
            jSent.onResponseCallback(json, jSent, QUERY_STATUS.HAVE_RESPONSE);
        }else{
            $.each(root.customHandler, function(index, Handler){
                if(Handler.type == json.type){
                    Handler.onResponseCallback(json, jSent, QUERY_STATUS.HAVE_RESPONSE);
                }
            });
        }
    };

    root.check_ws = function(override, onConnectedCallback){

        if(onConnectedCallback){
            root.onConnectedCallback = onConnectedCallback;
        }

        if(root.ws && (root.ws.readyState == WebSocket.CONNECTING || root.ws.readyState == WebSocket.OPEN)){
            return QUERY_STATUS.SEND_TO_SERVER_ALLOWED;
        }

        if(root.connectionState == CONNECTION_STATE.LOGOUT && !override){
            return QUERY_STATUS.ERROR_NOT_CONNECTED;
        }

        root.connectionState = CONNECTION_STATE.NOT_CONNECTED;

        var WS = false;
        if (window.WebSocket) WS = WebSocket;
        if (!WS && window.MozWebSocket) WS = MozWebSocket;
        if (!WS)
            console.log("WebSocket not supported by this browser");

        root.ws = new WS(SETTINGS.url);
        root.ws.onopen = root._onopen;
        root.ws.onmessage = root._onmessage;
        root.ws.onclose = root._onclose;
        root.ws.onerror = root._onerror;

        return QUERY_STATUS.ERROR_NOT_CONNECTED;
    };

    root.sendAckJson = function(id){
      var json = {};
      json.type = MSG_TYPES.ACK;
      json.id = id;
      root.send(json, true);
    };

    root.send = function(json, inQ, onResponseCallback){
        var toReturn = root.check_ws(false);
        if(toReturn == QUERY_STATUS.SEND_TO_SERVER_ALLOWED){
            var data = root.getJsonToSend(json);
			console.log("sending: " + data);
            root.ws.send(data);
            toReturn = true;
        }

        root.storeInQ(json, inQ, onResponseCallback);
		
		return toReturn;
    };

    root.storeInQ = function(json, inQ, onResponseCallback){
        if(inQ){
            return;
        }
        var found = false;
        $.each(root.toSendQ, function(index, jinQ){
            if(jinQ.id == json.id){
                found = true;
            }
        });

        if(!found){
            json.sentTs = getTs();
            if(onResponseCallback){
                json.onResponseCallback = onResponseCallback;
            }
            root.toSendQ.push(json)
        }
    };

    root.getJsonToSend = function(json){
        var clone_of_json = JSON.parse(	JSON.stringify( json ) );
        delete clone_of_json.sentTs;
        delete clone_of_json.onResponseCallback;
        return JSON.stringify(clone_of_json);
    };

    root.ontimeout = function(){

        var timenow = getTs();
        $.each(root.toSendQ, function(index, json){
           var interval = timenow - json.sentTs;
            if(interval > SETTINGS.resend_interval){
                root.send(json, true);
            }
        });
        root.resendTimer = setTimeout(root.ontimeout, SETTINGS.resend_interval);
    };

    root.processIncomingJson = function(json, jSent){
        var type = json.type;
        switch(type) {
            case MSG_TYPES.ERROR:
                console.log(jSent.type + " is not valid route on server");
                break;
            case MSG_TYPES.ACCOUNT_AUTHENTICATE:
                if (json.code == CODE_MAP.success) {
                    root.connectionState = CONNECTION_STATE.AUTHENTICATED;
                    root.user = json.user;
                    $.each(root.pushOnLogin, function (index, onLoginCallback) {
                        onLoginCallback();
                    });
                    root.getFriends();
                    root.ontimeout();
                }else{
                    root.connectionState = CONNECTION_STATE.CONNECTED;
                }
                break;
            case MSG_TYPES.GET_FRIENDS:
                if (jSent && !jSent.user) {
                    root.friends = json;
                }
                break;
            case MSG_TYPES.MSG_DATA:

                if(root.isIncomingChat(json)){
                    root.sendDeliveryReceipt(json.user, json.id);
                }

                break;
            case MSG_TYPES.MSG_DELIVERY_RECIEPT:
                // json.id got delivered to end user

                break;
            case MSG_TYPES.MSG_READ_RECIEPT:
                // json.id was read by end user
                break;
            case MSG_TYPES.MSG_PRIV:
                //json.user
                switch (json.subtype) {
                    case SUB_TYPE.TYPING:
                        break;
                    case SUB_TYPE.PAUSED:
                        break;
                    case SUB_TYPE.STOPPED:
                        break;
                }
                break;
            case MSG_TYPES.MSG_GROUP_DATA:
                // incoming group message
                break;
            case MSG_TYPES.ADD_MEMS_TO_GROUP:
                // new user joined group
                break;
            case MSG_TYPES.LEAVE_GROUP:
                // user left group
                break;
//           this code below for archives is just for example purposes
//           case MSG_TYPES.GET_ARCHIVE:
//                $.each(json.archives, function(index, archive){
//                    if(jSent.user){
//                          // priv chat
//                         if(root.isIncomingChat(archive)){
//                         }else{
//                         }
//                    }else if(jSent.group){
//                          // group message
//                          if(archive.user == root.user){
//                                // sent by this user
//                            }else
//                            {
//                                // sent by someone else
//                            }
//                    }
//                });
//                var fetchMore = true;
//                if(fetchMore && archive.length == 100){
//                    root.getArchiveGroup(jSent.group, archive.pop().archived_at, jSent.callback);
//                }
//                break;
        }
    };

    // outgoing api

    root.loginByUserName = function(user, pass, onResponseCallback){
        var json = {
            type: MSG_TYPES.ACCOUNT_AUTHENTICATE,
            user: user,
            pass: pass,
            id : genMsgId()
        };

        root.addtoPushOnLogin(onResponseCallback);
        return root.send(json, true, null);
    };

    root.loginByUserId = function(userid, authtoken, onResponseCallback){
        root.user = userid;
        var json = {
            type: MSG_TYPES.ACCOUNT_AUTHENTICATE,
            userid: userid,
            authtoken: authtoken,
            id : genMsgId()
        };

        root.addtoPushOnLogin(onResponseCallback);
        return root.send(json, true, null);
    };

    root.getLastSeen = function(user, onResponseCallback){
        var json = {
            type: MSG_TYPES.ACCOUNT_LAST_SEEN,
            user: user,
            id : genMsgId()
        };

        return root.send(json, false, onResponseCallback);
    };

    root.getFriends = function(fetchFromServer, onResponseCallback){


        if(!fetchFromServer){
            if(root.friends){
                if(onResponseCallback) {
                    onResponseCallback(root.friends, null, QUERY_STATUS.HAVE_RESPONSE);
                }
                return QUERY_STATUS.HAVE_RESPONSE;
            }else{
                return QUERY_STATUS.ERROR_NO_RESPONSE;
            }
        }

        var json = {
            type : MSG_TYPES.GET_FRIENDS,
            id : genMsgId()
        };

        return root.send(json, false, onResponseCallback);
    };

    root.blockUser = function(user, onResponseCallback) {
        var json = {
            type : MSG_TYPES.BLOCK_USER,
            user : user,
            id : genMsgId()
        };

        return root.send(json, false, onResponseCallback);
    };

    root.unBlockUser = function(user, onResponseCallback){
        var json = {
            type : MSG_TYPES.UNBLOCK_USER,
            user : user,
            id : genMsgId()
        };

        return root.send(json, false, onResponseCallback);
    };

    // helper functions to upload file and send to user below. use this for advanced purposes

    root.getAmazonS3UploadPolicy = function(onResponseCallback){
        var json = {
            type : MSG_TYPES.AMAZON_S3_GET_UPLOAD,
            id : genMsgId()
        };

        return root.send(json, false, onResponseCallback);
    };

    // helper functions to get signed url for resource on amazon s3. helper function for message below

    root.getS3DownloadUrl = function(s3Key, onResponseCallback){
        var json = {
            type : MSG_TYPES.AMAZON_S3_GET_DOWNLOAD,
            key : s3Key,
            id : genMsgId()
        };

        return root.send(json, true, onResponseCallback);
    };

    root.getArchive = function(user, group, ts, onResponseCallback){
        var json = {
            type : MSG_TYPES.GET_ARCHIVE,
            id : genMsgId()
        };

        if(user){
            json.user = user;
        }else if(group){
            json.group = group;
        }else{
            if(onResponseCallback){
                onResponseCallback(null, null, QUERY_STATUS.ERROR_INVALID_PARAMS);
            }
            return QUERY_STATUS.ERROR_INVALID_PARAMS;
        }

        if(ts){
            json.ts = ts;
        }

        return root.send(json, false, onResponseCallback);
    };

    root.sendDeliveryReceipt = function(user, id, onResponseCallback){
        var json = {
            type : MSG_TYPES.MSG_DELIVERY_RECIEPT,
            user : user,
            id : id
        };

        return root.send(json, false, onResponseCallback);
    };

    root.sendReadReceipt = function(user, id, onResponseCallback){
        var json = {
            type : MSG_TYPES.MSG_READ_RECIEPT,
            user : user,
            id : id
        };

        return root.send(json, false, onResponseCallback);
    };

    root.sendTypingStarted = function(user){
        var json = {
            type : MSG_TYPES.MSG_PRIV,
            user : user,
            subtype : SUB_TYPE.TYPING,
            id : genMsgId()
        };

        return root.send(json, true, null);
    };

    root.sendTypingPaused = function(user){

        var json = {
            type : MSG_TYPES.MSG_PRIV,
            user : user,
            subtype : SUB_TYPE.PAUSED,
            id : genMsgId()
        };

        return root.send(json, true, null);
    };

    root.sendTypingStopped = function(user){
        var json = {
            type : MSG_TYPES.MSG_PRIV,
            user : user,
            subtype : SUB_TYPE.STOPPED,
            id : genMsgId()
        };

        return root.send(json, true, null);
    };

    root.getMyGroups = function(onResponseCallback){
        var json = {
            type : MSG_TYPES.LIST_GROUPS,
            id : genMsgId()
        };

        return root.send(json, false, onResponseCallback);
    };

    root.getGroupMembers = function(group, onResponseCallback){
        var json = {
            type : MSG_TYPES.LIST_GROUP_MEMBERS,
            group : group,
            id : genMsgId()
        };

        return root.send(json, false, onResponseCallback);
    };

    root.createGroup = function(name, onResponseCallback){
        var json = {
            type : MSG_TYPES.CREATE_GROUP,
            name : name,
            id : genMsgId()
        };

        return root.send(json, false, onResponseCallback);
    };

    root.leaveGroup = function(group, onResponseCallback){
        return root.kickUserFromGroup(group, null, onResponseCallback);
    };

    root.kickUserFromGroup = function(group, user, onResponseCallback){
        var json = {
            type : MSG_TYPES.LEAVE_GROUP,
            group : group,
            id : genMsgId()
        };

        if(user){
            json.user = user;
        }

        return root.send(json, false, onResponseCallback);
    };

    root.joinGroup = function(group, user, onResponseCallback){
        var users = [user];
        return addMemsToGroup(group, users, onResponseCallback);
    };

    // users = ['ads', 'ads']
    root.addMemsToGroup = function(group, users, onResponseCallback){
        var json = {
            type : MSG_TYPES.ADD_MEMS_TO_GROUP,
            group : group,
            users : users,
            id : genMsgId()
        };

        return root.send(json, false, onResponseCallback);
    };

    root.sendDataToUser = function(user, group, data, onResponseCallback){
        var json = {
            data : data,
            id : genMsgId()
        };

        if(user){
           json.type = MSG_TYPES.MSG_DATA;
            json.user = user;
        }else if(group){
            json.type = MSG_TYPES.MSG_GROUP_DATA;
            json.group = group;
        }else{

            if(onResponseCallback){
                onResponseCallback(null, null, QUERY_STATUS.ERROR_INVALID_PARAMS);
            }
            return false;
        }

        return root.send(json, false, onResponseCallback);
    };

    root.sendTextMsg = function(user, group, msg, onResponseCallback){
        var data = {
            msg: msg,
            subtype: MSG_DATA_TYPE.TEXT
        };

        return root.sendDataToUser(user, group, data, onResponseCallback);
    };

    root.sendLocationMsg = function(user, group, latitude, longitude, onResponseCallback){
        var data = {
            latitude: latitude,
            longitude : longitude,
            subtype: MSG_DATA_TYPE.LOCATION
        };

        return root.sendDataToUser(user, group, data, onResponseCallback);
    };

    root.uploadAndSendFileMsg = function(user, group, file, s3Dir, uploadProgress, onResponseCallback){
        if(!user && !group){
            if(onResponseCallback){
                onResponseCallback(null, null, QUERY_STATUS.ERROR_INVALID_PARAMS);
            }
            return QUERY_STATUS.ERROR_INVALID_PARAMS;
        }

        return root.getAmazonS3UploadPolicy(function(json, jSent, reqStatus){

            if(reqStatus != QUERY_STATUS.HAVE_RESPONSE){

                if(onResponseCallback){
                    onResponseCallback(null, null, QUERY_STATUS.ERROR_FILE_UPLOAD_FAILED);
                }
                return;
            }

            var fd = new FormData();

            var key = genRandomId();

            var s3Key = getS3FilePath(key, s3Dir);

            fd.append('AWSAccessKeyId',  json.aws_key);
            fd.append('acl', 'private');
            fd.append('key', s3Key);
            fd.append('signature', json.signature);
            fd.append('policy', json.policy);
            fd.append('Content-Type', file.type);
            fd.append('success_action_status', '201');

            fd.append("file",file);

            var xhr = new XMLHttpRequest();
            var uploadCompleteCallBack = function(){
                var data = {
                    subtype : SUB_TYPE.FILE,
                    s3_dir : s3Dir,
                    key : key
                };

                return root.sendDataToUser(user, group, data, onResponseCallback);
            };

            var errorCallBack = function(){
                if(onResponseCallback){
                    onResponseCallback(null, null, QUERY_STATUS.ERROR_FILE_UPLOAD_FAILED);
                }
            };
            if(uploadProgress){
                xhr.upload.addEventListener("progress", uploadProgress, false);
            }
            xhr.addEventListener("load", uploadCompleteCallBack, false);
            xhr.addEventListener("error", errorCallBack, false);
            xhr.addEventListener("abort", errorCallBack, false);

            xhr.open('POST', 'https://" + json.bucket + ".s3.amazonaws.com/', true); //MUST BE LAST LINE BEFORE YOU SEND

            xhr.send(fd);
        });
    };

    root.downloadS3File = function(key, s3Dir, onResponseCallback){
        var s3Key = getS3FilePath(key, s3Dir);
        return root.getS3DownloadUrl(s3Key, function(json, jSent, reqStatus){
            if(onResponseCallback){
                // json.url
                onResponseCallback(json, jSent, reqStatus);
            }
        });
    };

    root.isIncomingChat = function(json){
        if(json.dir && json.dir == MSG_DIRECTION.IN){
            return true;
        }else if(json.user && json.user != root.user){
            return true;
        }

        return false;
    };

    root.logout = function(onResponseCallback){
        root.connectionState = CONNECTION_STATE.LOGOUT;
        var json = {
            type: MSG_TYPES.ACCOUNT_LOGOUT
        };
        root.send(json, true);
        root._onclose("logout");

        $.each(root.toSendQ, function(index, jinQ){
            if(jinQ.onResponseCallback){
                jinQ.onResponseCallback(jinQ, null, QUERY_STATUS.ERROR_NO_RESPONSE);
            }
        });

        root.toSendQ = [];

        if(onResponseCallback){
            onResponseCallback(json, null, QUERY_STATUS.ERROR_NO_RESPONSE);
        }
        return QUERY_STATUS.SEND_TO_SERVER_ALLOWED;
    };

    return root;
}

function getS3FilePath(key, s3Dir){
    var extension = "custom";
    switch (s3Dir){
        case S3_DIR.PROFILE:
            extension = "png";
            break;
        case S3_DIR.TRANSFER_PHOTO :
            extension = "png";
            break;
        case S3_DIR.TRANSFER_AUDIO :
            extension = "mp3";
            break;
        case S3_DIR.TRANSFER_VIDEO :
            extension = "mp4";
            break;
    }

    var subDir = "transfer_custom";
    switch (s3Dir){
        case S3_DIR.PROFILE:
            subDir = "profile";
            break;
        case S3_DIR.TRANSFER_PHOTO :
            subDir = "transfer_photo";
            break;
        case S3_DIR.TRANSFER_AUDIO :
            subDir = "transfer_audio";
            break;
        case S3_DIR.TRANSFER_VIDEO :
            subDir = "transfer_video";
            break;
    }

    return subDir + "/" + key + "." + extension;
}

function getTs(){
    if (!Date.now) {
        return new Date().getTime();
    }else{
        return Date.now();
    }
}

function genMsgId(){
    var id = genRandomId();
    return id.substring(0, 8);
}

function genRandomId(){
    return 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'.replace(/[x]/g, function(c) {
        var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
    });
}