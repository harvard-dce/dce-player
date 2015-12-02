/*** File: paella-matterhorn/javascript/01_prerequisites.js ***/
paella.matterhorn = {};


var engageURL = 'https://localhost:3000';

// Patch to work with MH jetty server. 
base.ajax.send = function(type,params,onSuccess,onFail) {
	this.assertParams(params);

	var ajaxObj = jQuery.ajax({
		url:params.url,
		data:params.params,
		cache:false,
		type:type
	});
	
	if (typeof(onSuccess)=='function') {
		ajaxObj.done(function(data,textStatus,jqXHR) {
			var contentType = jqXHR.getResponseHeader('content-type');
			onSuccess(data,contentType,jqXHR.status,jqXHR.responseText);
		});
	}
	
	if (typeof(onFail)=='function') {
		ajaxObj.fail(function(jqXHR,textStatus,error) {
			var data = jqXHR.responseText;
			var contentType = jqXHR.getResponseHeader('content-type');
			if ( (jqXHR.status == 200) && (typeof(jqXHR.responseText)=='string') ) {
				try {
					data = JSON.parse(jqXHR.responseText);
				}
				catch (e) {
					onFail(textStatus + ' : ' + error,'text/plain',jqXHR.status,jqXHR.responseText);
				}
				onSuccess(data,contentType,jqXHR.status,jqXHR.responseText);
			}
			else{
				onFail(textStatus + ' : ' + error,'text/plain',jqXHR.status,jqXHR.responseText);
			}		
		});
	}
};
/*** File: paella-matterhorn/javascript/02_accesscontrol.js ***/
/*

User login, data and permissions: paella.AccessControl

Extend paella.AccessControl and implement the checkAccess method:

*/

var MHAccessControl = Class.create(paella.AccessControl,{
	checkAccess:function(onSuccess) {
		this.permissions.canRead = false;
		this.permissions.canWrite = false;
		this.permissions.canContribute = false;
		this.permissions.loadError = true;
		this.permissions.isAnonymous = false;

		this.userData.username = 'anonymous';
		this.userData.name = 'Anonymous';
		this.userData.avatar = 'resources/images/default_avatar.png';

		if (paella.matterhorn) {	
			if (paella.matterhorn.me) {
				var role_i, currentRole;
				this.userData.username = paella.matterhorn.me.username;
				this.userData.name = paella.matterhorn.me.username;
				
				this.permissions.loadError = false;
				var roles = paella.matterhorn.me.roles;
				var adminRole = paella.matterhorn.me.org.adminRole;
				var anonymousRole = paella.matterhorn.me.org.anonymousRole;
	
				if (!(roles instanceof Array)) { roles = [roles]; }
	
				if (paella.matterhorn.acl && paella.matterhorn.acl.acl && paella.matterhorn.acl.acl.ace) {
					var aces = paella.matterhorn.acl.acl.ace;
					if (!(aces instanceof Array)) { aces = [aces]; }

					for (role_i=0; role_i<roles.length; ++role_i) {
						currentRole = roles[role_i];
						for(var ace_i=0; ace_i<aces.length; ++ace_i) {
							var currentAce = aces[ace_i];
							if (currentRole == currentAce.role) {
								if (currentAce.action == "read") {this.permissions.canRead = true;}
								if (currentAce.action == "write") {this.permissions.canWrite = true;}
							}
						}
					}
				}
				else {
					this.permissions.canRead = true;
				}				
				// Chek for admin!
				for (role_i=0; role_i<roles.length; ++role_i) {
					currentRole = roles[role_i];
					if (currentRole == anonymousRole) {
						this.permissions.isAnonymous = true;
					}
					if (currentRole == adminRole) {
						this.permissions.canRead = true;
						this.permissions.canWrite = true;
						this.permissions.canContribute = true;
						break;
					}
				}	
			}
		}
		onSuccess(this.permissions);
	}
});

/*** File: paella-matterhorn/javascript/modified-classes/videoloader-for-paella41.js ***/
/*

Video data: paella.VideoLoader

Extend paella.VideoLoader and implement the loadVideo method:

*/


var MHVideoLoader = Class.create(paella.VideoLoader, {
  isStreaming:function(track) {
    return /rtmp:\/\//.test(track.url);
  },

  getStreamSource:function(track) {
    var res = new Array(0,0);
        if (track.video instanceof Object) {
        res = track.video.resolution.split('x');
        }

    var src = track.url;
    var urlSplit = /^(rtmp:\/\/[^\/]*\/[^\/]*)\/(.*)$/.exec(track.url);
    if (urlSplit != null) {
      var rtmp_server =  urlSplit[1];
      var rtmp_stream =  urlSplit[2];     
      src = {
        server: encodeURIComponent(rtmp_server),
        stream: encodeURIComponent(rtmp_stream)
      };
    }

    var source = {      
      src:  src,
      type: track.mimetype,
      res: {w:res[0], h:res[1]},
      isLiveStream: (track.live===true)
    };

    return source;
  },

  isSupportedStreamingTrack: function(track) {
    if (/^(rtmp:\/\/[^\/]*\/[^\/]*)\/(.*)$/.test(track.url) == true) {
      switch (track.mimetype) {
        case 'video/mp4':
        case 'video/ogg':
        case 'video/webm':
        case 'video/x-flv':
          return true;
        default:
          return false;
      }
    }
    return false;
  },


  loadVideo:function(videoId,onSuccess) {
    var i;
    var streams = {};
    var tracks = paella.matterhorn.episode.mediapackage.media.track;
    var attachments = paella.matterhorn.episode.mediapackage.attachments.attachment;
    if (!(tracks instanceof Array)) { tracks = [tracks]; }
    if (!(attachments instanceof Array)) { attachments = [attachments]; }
    this.frameList = {};


    // Read the tracks!!
    for (i=0;i<tracks.length;++i) {
      var currentTrack = tracks[i];
      var currentStream = streams[currentTrack.type];
      if (currentStream == undefined) { currentStream = { sources:{}, preview:'' }; }
      
      
      if (this.isStreaming(currentTrack)) {
        if (this.isSupportedStreamingTrack(currentTrack)) {
          if ( !(currentStream.sources['rtmp']) || !(currentStream.sources['rtmp'] instanceof Array)){
            currentStream.sources['rtmp'] = [];
          }
          currentStream.sources['rtmp'].push(this.getStreamSource(currentTrack));
        }
      }
      else{
        var videotype = null;
        switch (currentTrack.mimetype) {
          case 'video/mp4':
          case 'video/ogg':
          case 'video/webm':
            videotype = currentTrack.mimetype.split("/")[1];
            break;
          case 'video/x-flv':
            videotype = 'flv';
            break;
          default:
            paella.debug.log('MHVideoLoader: MimeType ('+currentTrack.mimetype+') not recognized!');
            break;
        }
        if (videotype){
          if ( !(currentStream.sources[videotype]) || !(currentStream.sources[videotype] instanceof Array)){
            currentStream.sources[videotype] = [];
          }       
          currentStream.sources[videotype].push(this.getStreamSource(currentTrack));
        }
      }

      streams[currentTrack.type] = currentStream;
    }
    
    var duration = parseInt(paella.matterhorn.episode.mediapackage.duration/1000);
    var presenter = streams["presenter/delivery"];
    var presentation = streams["presentation/delivery"];    
    var imageSource =   {type:"image/jpeg", frames:{}, count:0, duration: duration, res:{w:320, h:180}};
    var imageSourceHD = {type:"image/jpeg", frames:{}, count:0, duration: duration, res:{w:1280, h:720}};
    var blackboardSource = {type:"image/jpeg", frames:{}, count:0, duration: duration, res:{w:1280, h:720}};
    // Read the attachments
    for (i=0;i<attachments.length;++i) {
      var currentAttachment = attachments[i];

      if (currentAttachment !== undefined) {
        try {
          if (currentAttachment.type == "blackboard/image") {
            if (/time=T(\d+):(\d+):(\d+)/.test(currentAttachment.ref)) {
              time = parseInt(RegExp.$1)*60*60 + parseInt(RegExp.$2)*60 + parseInt(RegExp.$3);
              
              blackboardSource.frames["frame_"+time] = currentAttachment.url;
              blackboardSource.count = blackboardSource.count +1;                 
            }
          
          }
          else if (currentAttachment.type == "presentation/segment+preview+hires") {
            if (/time=T(\d+):(\d+):(\d+)/.test(currentAttachment.ref)) {
              time = parseInt(RegExp.$1)*60*60 + parseInt(RegExp.$2)*60 + parseInt(RegExp.$3);
              imageSourceHD.frames["frame_"+time] = currentAttachment.url;
              imageSourceHD.count = imageSourceHD.count +1;
                  
                  if (!(this.frameList[time])){
                      this.frameList[time] = {id:'frame_'+time, mimetype:currentAttachment.mimetype, time:time, url:currentAttachment.url, thumb:currentAttachment.url};                  
                  }
                  this.frameList[time].url = currentAttachment.url;
            }
          }
          else if (currentAttachment.type == "presentation/segment+preview") {
            if (/time=T(\d+):(\d+):(\d+)/.test(currentAttachment.ref)) {
              time = parseInt(RegExp.$1)*60*60 + parseInt(RegExp.$2)*60 + parseInt(RegExp.$3);
              imageSource.frames["frame_"+time] = currentAttachment.url;
              imageSource.count = imageSource.count +1;
              
                  if (!(this.frameList[time])){
                      this.frameList[time] = {id:'frame_'+time, mimetype:currentAttachment.mimetype, time:time, url:currentAttachment.url, thumb:currentAttachment.url};                  
                  }
                  this.frameList[time].thumb = currentAttachment.url;
            }
          }
          else if (currentAttachment.type == "presentation/player+preview") {
            presentation.preview = currentAttachment.url;
          }
          else if (currentAttachment.type == "presenter/player+preview") {
            presenter.preview = currentAttachment.url;
          }
        } 
        catch (err) {}
      }
    }

    // Set the image stream
    var imagesArray = [];
    if (imageSourceHD.count > 0) { imagesArray.push(imageSourceHD); }
    if (imageSource.count > 0) { imagesArray.push(imageSource); }
    if ( (imagesArray.length > 0) && (presentation != undefined) ){
      presentation.sources.image = imagesArray; 
    }
    
    // Set the blackboard images
    var blackboardArray = [];
    if (blackboardSource.count > 0) { blackboardArray.push(blackboardSource); }   
    if ( (blackboardArray.length > 0) && (presenter != undefined) ){
      presenter.sources.image = blackboardArray;
    }   
    
  
    if (presenter) { this.streams.push(presenter); }
    if (presentation) { this.streams.push(presentation); }

    // Callback
    this.loadStatus = true;
    onSuccess();      
  }
});

/*** File: paella-matterhorn/javascript/04_datadelegates.js ***/

paella.dataDelegates.MHAnnotationServiceDefaultDataDelegate = Class.create(paella.DataDelegate,{
	read:function(context,params,onSuccess) {
		var episodeId = params.id;
		paella.ajax.get({url: '/annotation/annotations.json', params: {episode: episodeId, type: "paella/"+context}},	
			function(data, contentType, returnCode) { 
 				var annotations = data.annotations.annotation;
				if (!(annotations instanceof Array)) { annotations = [annotations]; }
				if (annotations.length > 0) {
					if (annotations[0] && annotations[0].value !== undefined) {
						var value = annotations[0].value;
						try {
							value = JSON.parse(value);
						}
						catch(err) {}
						if (onSuccess) onSuccess(value, true); 
					}
					else{
						if (onSuccess) onSuccess(undefined, false);
					}
				}
				else {
					if (onSuccess) onSuccess(undefined, false);
				}
			},
			function(data, contentType, returnCode) { onSuccess(undefined, false); }
		);
	},

	write:function(context,params,value,onSuccess) {
		var thisClass = this;
		var episodeId = params.id;
		if (typeof(value)=='object') value = JSON.stringify(value);

		paella.ajax.get({url: '/annotation/annotations.json', params: {episode: episodeId, type: "paella/"+context}},	
			function(data, contentType, returnCode) { 
				var annotations = data.annotations.annotation;
				if (annotations == undefined) {annotations = [];}
				if (!(annotations instanceof Array)) { annotations = [annotations]; }
				
				if (annotations.length == 0 ) {
					paella.ajax.put({ url: '/annotation/',
						params: {
							episode: episodeId, 
							type: 'paella/' + context,
							value: value,
							'in': 0
						}},	
						function(data, contentType, returnCode) { onSuccess({}, true); },
						function(data, contentType, returnCode) { onSuccess({}, false); }
					);				
				}
				else if (annotations.length == 1 ) {
					var annotationId = annotations[0].annotationId;
					paella.ajax.put({ url: '/annotation/'+ annotationId, params: { value: value }},	
						function(data, contentType, returnCode) { onSuccess({}, true); },
						function(data, contentType, returnCode) { onSuccess({}, false); }
					);
				}
				else if (annotations.length > 1 ) {
					thisClass.remove(context, params, function(notUsed, removeOk){
						if (removeOk){
							thisClass.write(context, params, value, onSuccess);
						}
						else{
							onSuccess({}, false);
						}
					});
				}
			},
			function(data, contentType, returnCode) { onSuccess({}, false); }
		);
	},
        
	remove:function(context,params,onSuccess) {
		var episodeId = params.id;

		paella.ajax.get({url: '/annotation/annotations.json', params: {episode: episodeId, type: "paella/"+context}},	
			function(data, contentType, returnCode) {
 				var annotations = data.annotations.annotation;
 				if(annotations) {
					if (!(annotations instanceof Array)) { annotations = [annotations]; }
					var asyncLoader = new paella.AsyncLoader();
					for ( var i=0; i< annotations.length; ++i) {
						var annotationId = data.annotations.annotation.annotationId;
						asyncLoader.addCallback(new paella.JSONCallback({url:'/annotation/'+annotationId}, "DELETE"));
					}
					asyncLoader.load(function(){ if (onSuccess) { onSuccess({}, true); } }, function() { onSuccess({}, false); });
				}
				else {
					if (onSuccess) { onSuccess({}, true); }
				}				
			},
			function(data, contentType, returnCode) { if (onSuccess) { onSuccess({}, false); } }
		);
	}
});

paella.dataDelegates.MHAnnotationServiceTrimmingDataDelegate = Class.create(paella.dataDelegates.MHAnnotationServiceDefaultDataDelegate,{
	read:function(context,params,onSuccess) {
		this.parent(context, params, function(data,success) {
			if (success){
				if (data.trimming) {
					if (onSuccess) { onSuccess(data.trimming, success); }
				}
				else{
					if (onSuccess) { onSuccess(data, success); }
				}
			}
			else {
				if (onSuccess) { onSuccess(data, success); }
			}
		});
	},
	write:function(context,params,value,onSuccess) {
		this.parent(context, params, {trimming: value}, onSuccess);
	}
});


paella.dataDelegates.MHAnnotationServiceVideoExportDelegate = Class.create(paella.dataDelegates.MHAnnotationServiceDefaultDataDelegate,{
	read:function(context, params, onSuccess) {
		var ret = {};
		var thisParent = this.parent;
		
		thisParent(context, params, function(data, success) {
			if (success){
				ret.trackItems = data.trackItems;
				ret.metadata = data.metadata;
				
				thisParent(context+"#sent", params, function(dataSent, successSent) {
					if (successSent){
						ret.sent = dataSent.sent;
					}
					thisParent(context+"#inprogress", params, function(dataInProgress, successInProgress) {
						if (successInProgress) {
							ret.inprogress = dataInProgress.inprogress;
						}							
						
						if (onSuccess) { onSuccess(ret, true); }
					});
				});
			}
			else {
				if (onSuccess) { onSuccess({}, false); }
			}
		});
	},
	
	write:function(context, params, value, onSuccess) {
		var thisParent = this.parent;
		var thisClass = this;
		
		var valInprogress = { inprogress: value.inprogres };
		var valSent = { sent: value.sent };	
		var val = { trackItems:value.trackItems, metadata: value.metadata };
		if (val.trackItems.length > 0) {
			thisParent(context, params, val, function(data, success) {
				if (success) {			
					if (valSent.sent) {
						thisClass.remove(context+"#inprogress", params, function(data, success){					
							thisParent(context+"#sent", params, valSent, function(dataSent, successSent) {
								if (successSent) {						
									if (onSuccess) { onSuccess({}, true); }
								}
								else { if (onSuccess) { onSuccess({}, false); } }	
							});
						});
					}
					else {
						//if (onSuccess) { onSuccess({}, true); }
						thisClass.remove(context+"#sent", params, function(data, success){
							if (onSuccess) { onSuccess({}, success); }
						});
					}
				}
				else { if (onSuccess) { onSuccess({}, false); } }	
			});
		}
		else {
			this.remove(context, params, function(data, success){
				if (onSuccess) { onSuccess({}, success); }
			});
		}
	},
	
	remove:function(context, params, onSuccess) {
		var thisParent = this.parent;
	
		thisParent(context, params, function(data, success) {
			if (success) {
				thisParent(context+"#sent", params, function(dataSent, successSent) {
					if (successSent) {
						thisParent(context+"#inprogress", params, function(dataInProgress, successInProgress) {
							if (successInProgress) {
								if (onSuccess) { onSuccess({}, true); }
							}
							else { if (onSuccess) { onSuccess({}, false); } }	
						});
					}
					else { if (onSuccess) { onSuccess({}, false); } }	
				});	
			}
			else { if (onSuccess) { onSuccess({}, false); } }	
		});
	}	
});


paella.dataDelegates.UserDataDelegate = Class.create(paella.DataDelegate,{
    initialize:function() {
    },

    read:function(context, params, onSuccess) {
    	var value = {
			userName: params.username,
			name: params.username,
			lastname: '',
			avatar:"plugins/silhouette32.png"
		};
		
        if (typeof(onSuccess)=='function') { onSuccess(value,true); }
    }

});


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// Captions Loader
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
paella.matterhorn.DFXPParser = Class.create({
	
	parseCaptions:function(text)
	{
		var xml = $(text);
		var ps = xml.find("body div p");
		var captions= [];
		var i = 0;		
		for (i=0; i< ps.length; i++) {		
			var c = this.getCaptionInfo(ps[i]);
			c.id = i;
			captions.push(c);
		}		
		return captions;
	},
	
	getCaptionInfo:function(cap) {
		var b = this.parseTimeTextToSeg(cap.getAttribute("begin"));
		var d = this.parseTimeTextToSeg(cap.getAttribute("end"));
		var v = $(cap).text();
		
		return {s:b, d:d, e:b+d, name:v, content:v};
	},
	
	parseTimeTextToSeg:function(ttime){
		var nseg = 0;
		var segtime = /^([0-9]*([.,][0-9]*)?)s/.test(ttime);
		if (segtime){
			nseg = parseFloat(RegExp.$1);
		}
		else {
			var split = ttime.split(":");
			var h = parseInt(split[0]);
			var m = parseInt(split[1]);
			var s = parseInt(split[2]);
			nseg = s+(m*60)+(h*60*60);
		}
		return nseg;
	},
	
	captionsToDxfp:function(captions){
		var xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
		xml = xml + '<tt xml:lang="en" xmlns="http://www.w3.org/2006/10/ttaf1" xmlns:tts="http://www.w3.org/2006/04/ttaf1#styling">\n';
		xml = xml + '<body><div xml:id="captions" xml:lang="en">\n';
		
		for (var i=0; i<captions.length; i=i+1){
			var c = captions[i];
			xml = xml + '<p begin="'+ paella.utils.timeParse.secondsToTime(c.begin) +'" end="'+ paella.utils.timeParse.secondsToTime(c.duration) +'">' + c.value + '</p>\n';
		}
		xml = xml + '</div></body></tt>';
		
		return xml;
	}
});

paella.dataDelegates.MHCaptionsDataDelegate = Class.create(paella.DataDelegate,{
	read:function(context,params,onSuccess) {
		var catalogs = paella.matterhorn.episode.mediapackage.metadata.catalog;
		if (!(catalogs instanceof Array)) {
			catalogs = [catalogs];
		}
		
		var captionsFound = false;
		
		for (var i=0; ((i<catalogs.length) && (captionsFound == false)); ++i) {
			var catalog = catalogs[i];
			
			if (catalog.type == 'captions/timedtext') {
				captionsFound = true;
				
				// Load Captions!
				paella.ajax.get({url: catalog.url},	
					function(data, contentType, returnCode, dataRaw) {
					
						var parser = new paella.matterhorn.DFXPParser();
						var captions = parser.parseCaptions(data);						
						if (onSuccess) onSuccess({captions:captions}, true);
											
					},
					function(data, contentType, returnCode) {
						if (onSuccess) { onSuccess({}, false); }
					}
				);								
			}
		}
		
		if (captionsFound == false){
			if (onSuccess) { onSuccess({}, false); }
		}
	},
	
	write:function(context,params,value,onSuccess) {
		if (onSuccess) { onSuccess({}, false); }
	},
	
	remove:function(context,params,onSuccess) {
		if (onSuccess) { onSuccess({}, false); }
	}
});


paella.dataDelegates.MHFootPrintsDataDelegate = Class.create(paella.DataDelegate,{
	read:function(context,params,onSuccess) {
		var episodeId = params.id;
		
		paella.ajax.get({url: '/usertracking/footprint.json', params: {id: episodeId}},	
			function(data, contentType, returnCode) { 				
				if ((returnCode == 200) && (contentType == 'application/json')) {
					var footPrintsData = data.footprints.footprint;
					if (data.footprints.total == "1"){
						footPrintsData = [footPrintsData];
					}
					if (onSuccess) { onSuccess(footPrintsData, true); }
				}
				else{
					if (onSuccess) { onSuccess({}, false); }					
				}			
			},
			function(data, contentType, returnCode) {
				if (onSuccess) { onSuccess({}, false); }
			}
		);
	},

	write:function(context,params,value,onSuccess) {
		var thisClass = this;
		var episodeId = params.id;
		// #DCE correct js syntax on reserved term: 'in'
		var inpoint = value['in'];
		paella.ajax.get({url: '/usertracking/', params: {
					_method: 'PUT',
					id: episodeId,
					type:'FOOTPRINT',
					'in':value.in,
					out:value.out }
			},
			function(data, contentType, returnCode) {
				var ret = false;
				if (returnCode == 201) { ret = true; }								
				if (onSuccess) { onSuccess({}, ret); }
			},
			function(data, contentType, returnCode) {
				if (onSuccess) { onSuccess({}, false); }
			}
		);
	}
});



/*** File: paella-matterhorn/javascript/05_initdelegate.js ***/

function initPaellaMatterhornMe(onSuccess, onError) {

	base.ajax.get({url: engageURL + '/info/me.json'},
		function(data,contentType,code) {
			paella.matterhorn.me = data;
			if (onSuccess) onSuccess();
		},
		function(data,contentType,code) { if (onError) onError(); }
	);
}

function initPaellaMatterhorn(episodeId, onSuccess, onError) {

	initPaellaMatterhornMe(
		function(){
			base.ajax.get({url:'/search/episode.json', params:{'id': episodeId}},
				function(data,contentType,code) {
					//#DCE auth result check
					var jsonData = data;
					if (typeof (jsonData) == "string") jsonData = JSON.parse(jsonData);
					// test if result is Harvard auth or episode data
					if (!isHarvardDceAuth(jsonData)) {
					   return;
					}
					// #DCE end auth check

					// #DCE verify that results returned at least one episode
					var totalItems = parseInt(data['search-results'].total);
					if (totalItems === 0) {
					   showLoadErrorMessage(paella.dictionary.translate("No recordings found for episode id") + ": \"" + episodeId + "\"");
					   return;
					}

					paella.matterhorn.episode = data['search-results'].result;
					var asyncLoader = new paella.AsyncLoader();
					var offeringId = null;
					var type = null;

					if (paella.matterhorn.episode) {
					   var serie = paella.matterhorn.episode.mediapackage.series;

					   //#DCE logging helper code
					   //TODO: This is assuming we only have one result...
					   var result = data['search-results'].result;
					   if (result != undefined) {
					       if (result.dcIsPartOf != undefined) {
							 offeringId = result.dcIsPartOf.toString();
					       }
					       if (result.dcType != undefined) {
						      type = data['search-results'].result.dcType.toString();
					       }
					   }
					   if (offeringId && type) {
							paella.matterhorn.resourceId = (offeringId.length >= 11 ? "/" + offeringId.substring(0, 4) +
									"/" + offeringId.substring(4, 6) + "/" + offeringId.substring(6,11) + "/" : "") + type;
					   } else {
					       paella.matterhorn.resourceId = "";
					   }
					   // end #DCE logging helper
					   if (serie != undefined) {
						// #DCE get series from Search endpoint
						searchSeriesToSeriesSeries(serie, function(seriesData) {
						    if (!paella.matterhorn.serie)  paella.matterhorn.serie = [];
						    paella.matterhorn.serie[ 'http://purl.org/dc/terms/'] = seriesData;
						});
						if (onSuccess) onSuccess();
					   }
				           else {
						if (onSuccess) onSuccess();
			 		   }
					}
					else {
				 	    if (onError) onError();
					}
				},
				function(data,contentType,code) { if (onError) onError(); }
			);
		},
		function() { if (onError) onError(); }
	);
}

// ------------------------------------------------------------
// #DCE(naomi): start of dce auth addition
var isHarvardDceAuth = function (jsonData) {

    // check that search-results are ok
    var resultsAvailable = (jsonData !== undefined) &&
    (jsonData[ 'search-results'] !== undefined) &&
    (jsonData[ 'search-results'].total !== undefined);

    // if search-results not ok, maybe auth-results?
    if (resultsAvailable === false) {
        var authResultsAvailable = (jsonData !== undefined) &&
        (jsonData[ 'dce-auth-results'] !== undefined) &&
        (jsonData[ 'dce-auth-results'].dceReturnStatus !== undefined);

        // auth-results not present, some other error
        if (authResultsAvailable === false) {
            paella.debug.log("Seach failed, response:  " + data);

            var message = "Cannot access specified video; authorization failed (" + data + ")";
            paella.messageBox.showError(message);
            $(document).trigger(paella.events.error, {
                error: message
            });
            return false;
        }

        // auth-results present, dealing with auth errors
        var authResult = jsonData[ 'dce-auth-results'];
        var returnStatus = authResult.dceReturnStatus;
        if (("401" == returnStatus || "403" == returnStatus) && authResult.dceLocation) {
            window.location.replace(authResult.dceLocation);
        } else {
            paella.messageBox.showError(authResult.dceErrorMessage);
            $(document).trigger(paella.events.error, {
                error: authResult.dceErrorMessage
            });
        }
        return false;
    } else {
        return true;
    }
};
// #DCE(naomi): end of dce auth addition
// ------------------------------------------------------------
// #DCE(karen): START, get search/series and tranform result into series/series format
// This tranforms the series data into the expected upstream series format
var searchSeriesToSeriesSeries = function (serie, onSuccess, onError) {
    base.ajax.get({
        url: '/search/series.json',
        params: {
            'id': serie
        }
    },
    function (data, contentType, code) {
        var jsonData = data;
        try {
            if (typeof (jsonData) == "string") jsonData = JSON.parse(jsonData);
        }
        catch (e) {
            showLoadErrorMessage(paella.dictionary.translate("Unable to parse series id") + "\"" + serie + "\" data: " + data);
            if (typeof (onError) == 'function') {
                onError();
            }
            return;
        }
        // #DCE verify that results returned at least one series
        var totalItems = parseInt(jsonData[ 'search-results'].total);
        if (totalItems === 0) {
            showLoadErrorMessage(paella.dictionary.translate("No series found for series id") + ": \"" + serie + "\"");
            if (typeof (onError) == 'function') {
                onError();
            }
            return;
        } else {
            var dcObject = {};
            var seriesResult = jsonData[ 'search-results'].result;
            for (var key in seriesResult) {
                // trim out "dc" and lower case first letter
                var keyTrimmed = key.replace(/^dc/, '');
                keyTrimmed = keyTrimmed.charAt(0).toLowerCase() + keyTrimmed.slice(1);
                dcObject[keyTrimmed] =[ {
                    "value": seriesResult[key]
                }];
            }
            if (typeof (onSuccess) == 'function') {
                onSuccess(dcObject);
            }
        }
    });
};
// #DCE(karen): END transform series format
// ------------------------------------------------------------
//#DCE show not found error
var showLoadErrorMessage = function (message) {
    paella.messageBox.showError(message);
    $(document).trigger(paella.events.error, {
          error: message
    });
};

paella.matterhorn.InitDelegate = Class.create(paella.InitDelegate,{
	loadConfig:function(onSuccess) {
		var configUrl = this.initParams.configUrl;
		var params = {};
		params.url = configUrl;
		paella.ajax.get(params,function(data, type, returnCode, responseRaw) {
				if (typeof(data)=='string') {
					try {
						data = JSON.parse(data);
					}
					catch (e) {
						onSuccess({});
					}
				}
				onSuccess(data);
			},
			function(data, type,returnCode, responseRaw) {
				if (returnCode == 200){
					if (typeof(responseRaw)=='string') {
						try {
							data = JSON.parse(responseRaw);
						}
						catch (e) {
							data = {};
						}
					}
					onSuccess(data);
				}
				else{
					onSuccess({});
				}
			});
	}
});

function loadPaella(containerId, onSuccess) {
	var initDelegate = new paella.matterhorn.InitDelegate({accessControl:new MHAccessControl(),videoLoader:new MHVideoLoader()});
	var id = paella.utils.parameters.get('id');

	initPaellaMatterhorn(id,
		function() {
			initPaellaEngage(containerId,initDelegate);
			if (onSuccess) onSuccess();
		},
		function() {
			if (paella.matterhorn.me.username == "anonymous") {
				// window.location.href = "auth.html?redirect=" + encodeURIComponent(window.location.href);
			}
			else {
				paella.messageBox.showError("Error loading video " + id);
			}		
		}
	);
}

function loadPaellaExtended(containerId, onSuccess) {
	var initDelegate = new paella.matterhorn.InitDelegate({accessControl:new MHAccessControl(),videoLoader:new MHVideoLoader()});
	var id = paella.utils.parameters.get('id');

	initPaellaMatterhorn(id,
		function() {
			initPaellaExtended({containerId:containerId,initDelegate:initDelegate});
			if (onSuccess) onSuccess();
		},
		function() {
			if (paella.matterhorn.me.username == "anonymous") {
				// window.location.href = "auth.html?redirect=" + encodeURIComponent(window.location.href);
			}
			else {
				paella.messageBox.showError("Error loading video " + id);
			}		
		}
	);
}

function loadPaellaEditor(containerId) {
    var EditorInitDelegate = Class.create(paella.matterhorn.InitDelegate,{
            loadConfig:function(onSuccess) {
				this.parent(function(data) {
					if (data.editor) {
						data.editor.loadOnStartup = true;
					}
					if (onSuccess) { onSuccess(data); }
				});
            }
    });

	var initDelegate = new EditorInitDelegate({accessControl:new MHAccessControl(),videoLoader:new MHVideoLoader()});
	var id = paella.utils.parameters.get('id');

	initPaellaMatterhorn(id, function() {initPaellaEngage(containerId,initDelegate);});
}

/*** File: paella-matterhorn/javascript/06_searchepisode.js ***/

paella.matterhorn.SearchEpisode = Class.create({
	config:null,
	proxyUrl:'',
	recordingEntryID:'',
	useJsonp:false,
	divLoading:null,
	divResults:null,

	AsyncLoaderPublishCallback: Class.create(paella.AsyncLoaderCallback,{
		config:null,
		recording:null,

		initialize:function(config, recording) {
			this.parent("AsyncLoaderPublishCallback");
			this.config = config;
			this.recording = recording;
		},

		load:function(onSuccess,onError) {
			var thisClass = this;
			
			paella.data.read('publish',{id:this.recording.id},function(data,status) {
				if (status == true) {
					if ((data == true) || (data == "True")) {
						thisClass.recording.entry_published_class = "published";
					}
					else if ((data == false) || (data == "False")) {
						thisClass.recording.entry_published_class = "unpublished";
					}
					else if (data == "undefined"){
						thisClass.recording.entry_published_class = "pendent";
					}
					else {
						thisClass.recording.entry_published_class = "no_publish_info";
					}
					onSuccess();
				}
				else {
					thisClass.recording.entry_published_class = "no_publish_info";
					onSuccess();
				}
			});
		}
	}),

	createDOMElement:function(type, id, className) {
		var elem = document.createElement(type);
		elem.id = id;
		elem.className = className;
		return elem;
	},

	doSearch:function(params, domElement) {
		var thisClass = this;
		this.recordingEntryID =	 domElement.id + "_entry_";


		domElement.innerHTML = "";
		// loading div
		this.divLoading = this.createDOMElement('div', thisClass.recordingEntryID + "_loading", "recordings_loading");
		this.divLoading.innerHTML = paella.dictionary.translate("Searching...");
		domElement.appendChild(this.divLoading);

		// header div
		var divHeader = this.createDOMElement('div', thisClass.recordingEntryID + "_header", "recordings_header");
		domElement.appendChild(divHeader);
		this.divResults = this.createDOMElement('div', thisClass.recordingEntryID + "_header_results", "recordings_header_results");		
		divHeader.appendChild(this.divResults);
		var divNavigation = this.createDOMElement('div', thisClass.recordingEntryID + "_header_navigation", "recordings_header_navigation");
		divHeader.appendChild(divNavigation);

		// loading results
		thisClass.setLoading(true);
		paella.ajax.get({url:'/search/episode.json', params:params},
			function(data, contentType, returnCode, dataRaw) {
				thisClass.processSearchResults(data, params, domElement, divNavigation);
			},
			function(data, contentType, returnCode) {
			}
		);
	},


	processSearchResults:function(response, params, divList, divNavigation) {
		var thisClass = this;
		if (typeof(response)=="string") {
			response = JSON.parse(response);
		}

		var resultsAvailable = (response !== undefined) &&
			(response['search-results'] !== undefined) &&
			(response['search-results'].total !== undefined);

		if (resultsAvailable === false) {
			paella.debug.log("Seach failed, respons:  " + response);
			return;
		}


		var totalItems = parseInt(response['search-results'].total);

		if (totalItems === 0) {
			if (params.q === undefined) {
				thisClass.setResults("No recordings");
			} else {
				thisClass.setResults("No recordings found: \"" + params.q + "\"");
			}
		} else {
			var offset = parseInt(response['search-results'].offset);
			var limit = parseInt(response['search-results'].limit);

			var startItem = offset;
			var endItem = offset + limit;
			if (startItem < endItem) {
			  startItem = startItem + 1;
			}

			if (params.q === undefined) {
				thisClass.setResults("Results " + startItem + "-" + endItem + " of " + totalItems);
			} else {
				thisClass.setResults("Results " + startItem + "-" + endItem + " of " + totalItems + " for \"" + params.q + "\"");
			}


			// *******************************
			// *******************************
			// TODO
			var asyncLoader = new paella.AsyncLoader();
			var results = response['search-results'].result;
			if (!(results instanceof Array)) { results = [results]; }
			//There are annotations of the desired type, deleting...
			for (var i =0; i < results.length; ++i ){
				asyncLoader.addCallback(new thisClass.AsyncLoaderPublishCallback(thisClass.config, results[i]));
			}

			asyncLoader.load(function() {
				var i;
				// create navigation div
				if (results.length < totalItems) {
					// current page
					var currentPage = 1;
					if (params.offset !== undefined) {
						currentPage = (params.offset / params.limit) + 1;
					}

					// max page
					var maxPage = parseInt(totalItems / params.limit);
					if (totalItems % 10 != 0) maxPage += 1;
					maxPage =  Math.max(1, maxPage);


					// previous link
					var divPrev = document.createElement('div');
					divPrev.id = thisClass.recordingEntryID + "_header_navigation_prev";
					divPrev.className = "recordings_header_navigation_prev";
					if (currentPage > 1) {
						var divPrevLink = document.createElement('a');
						divPrevLink.param_offset = (currentPage - 2) * params.limit;
						divPrevLink.param_limit	= params.limit;
						divPrevLink.param_q = params.q;
						divPrevLink.param_sid = params.sid;
						$(divPrevLink).click(function(event) {
							var params = {};
							params.offset = this.param_offset;
							params.limit = this.param_limit;
							params.q = this.param_q;
							params.sid = this.param_sid;
							thisClass.doSearch(params, divList);
						});
						divPrevLink.innerHTML = paella.dictionary.translate("Previous");
						divPrev.appendChild(divPrevLink);
					} else {
						divPrev.innerHTML = paella.dictionary.translate("Previous");
					}
					divNavigation.appendChild(divPrev);

					var divPage = document.createElement('div');
					divPage.id = thisClass.recordingEntryID + "_header_navigation_page";
					divPage.className = "recordings_header_navigation_page";
					divPage.innerHTML = paella.dictionary.translate("Page:");
					divNavigation.appendChild(divPage);

					// take care for the page buttons
					var spanBeforeSet = false;
					var spanAfterSet = false;
					var offsetPages = 2;
					for (i = 1; i <= maxPage; i++)	{
						var divPageId = document.createElement('div');
						divPageId.id = thisClass.recordingEntryID + "_header_navigation_pageid_"+i;
						divPageId.className = "recordings_header_navigation_pageid";

						if (!spanBeforeSet && currentPage >= 5 && i > 1 && (currentPage - (offsetPages + 2) != 1)) {
							divPageId.innerHTML = "...";
							i = currentPage - (offsetPages + 1);
							spanBeforeSet = true;
						}
						else if (!spanAfterSet && (i - offsetPages) > currentPage && maxPage - 1 > i && i > 4) {
							divPageId.innerHTML = "...";
							i = maxPage - 1;
							spanAfterSet = true;
						}
						else {
							if (i !== currentPage) {
								var divPageIdLink = document.createElement('a');
								divPageIdLink.param_offset = (i -1) * params.limit;
								divPageIdLink.param_limit = params.limit;
								divPageIdLink.param_q = params.q;
								divPageIdLink.param_sid = params.sid;
								$(divPageIdLink).click(function(event) {
									var params = {};
									params.offset = this.param_offset;
									params.limit = this.param_limit;
									params.q = this.param_q;
									params.sid = this.param_sid;
									thisClass.doSearch(params, divList);
								});
								divPageIdLink.innerHTML = i;
								divPageId.appendChild(divPageIdLink);
							} else {
								divPageId.innerHTML = i;
							}
						}
						divNavigation.appendChild(divPageId);
					}

					// next link
					var divNext = document.createElement('div');
					divNext.id = thisClass.recordingEntryID + "_header_navigation_next";
					divNext.className = "recordings_header_navigation_next";
					if (currentPage < maxPage) {
						var divNextLink = document.createElement('a');
						divNextLink.param_offset = currentPage * params.limit;
						divNextLink.param_limit	= params.limit;
						divNextLink.param_q = params.q;
						divNextLink.param_sid = params.sid;
						$(divNextLink).click(function(event) {
							var params = {};
							params.offset = this.param_offset;
							params.limit = this.param_limit;
							params.q = this.param_q;
							params.sid = this.param_sid;
							thisClass.doSearch(params, divList);
						});
						divNextLink.innerHTML = paella.dictionary.translate("Next");
						divNext.appendChild(divNextLink);
					} else {
						divNext.innerHTML = paella.dictionary.translate("Next");
					}
					divNavigation.appendChild(divNext);

				}

				// create recording divs
				for (i=0; i < results.length; ++i ){
					var recording = results[i];

					var divRecording = thisClass.createRecordingEntry(i, recording);
					divList.appendChild(divRecording);
				}
			}, null);
		}
		// finished loading
		thisClass.setLoading(false);	
	},


	setLoading:function(loading) {
		if (loading == true) {
			this.divLoading.style.display="block";
		} else {
			this.divLoading.style.display="none";
		}
	},

	setResults:function(results) {
		this.divResults.innerHTML = results;
	},

	getUrlOfAttachmentWithType:function(recording, type) {
		for (var i =0; i < recording.mediapackage.attachments.attachment.length; ++i ){
			var attachment = recording.mediapackage.attachments.attachment[i];
			if (attachment.type === type) {
				return attachment.url;
			}
		}

		return "";
	},

	createRecordingEntry:function(index, recording) {
		var rootID = this.recordingEntryID + index;


		var divEntry = document.createElement('div');
		divEntry.id = rootID;


		divEntry.className="recordings_entry " + recording.entry_published_class;
		if (index % 2 == 1) {
			divEntry.className=divEntry.className+" odd_entry";
		} else {
			divEntry.className=divEntry.className+" even_entry";
		}

		var previewUrl = this.getUrlOfAttachmentWithType(recording, "presentation/search+preview");
		if (previewUrl == "") {
			previewUrl = this.getUrlOfAttachmentWithType(recording, "presenter/search+preview");
		}

		var divPreview = document.createElement('div');
		divPreview.id = rootID+"_preview_container";
		divPreview.className = "recordings_entry_preview_container";
		var imgLink = document.createElement('a');
		imgLink.setAttribute("tabindex", "-1");
		imgLink.id = rootID+"_preview_link";
		imgLink.className = "recordings_entry_preview_link";
		imgLink.href = "watch.html?id=" + recording.id;
		var imgPreview = document.createElement('img');
		imgPreview.setAttribute('alt', '');
		imgPreview.setAttribute('title', recording.dcTitle);
		imgPreview.setAttribute('aria-label', recording.dcTitle);
		imgPreview.id = rootID+"_preview";
		imgPreview.src = previewUrl;
		imgPreview.className = "recordings_entry_preview";
		imgLink.appendChild(imgPreview);
		divPreview.appendChild(imgLink);
		divEntry.appendChild(divPreview);

		var divResultText = document.createElement('div');
		divResultText.id = rootID+"_text_container";
		divResultText.className = "recordings_entry_text_container";


		// title
		var divResultTitleText = document.createElement('div');
		divResultTitleText.id = rootID+"_text_title_container";
		divResultTitleText.className = "recordings_entry_text_title_container";
		var titleResultText = document.createElement('a');
		titleResultText.setAttribute("tabindex", "-1");
		titleResultText.id = rootID+"_text_title";
		titleResultText.innerHTML = recording.dcTitle;
		titleResultText.className = "recordings_entry_text_title";
		titleResultText.href = "watch.html?id=" + recording.id;
		divResultTitleText.appendChild(titleResultText);
		divResultText.appendChild(divResultTitleText);

		// #DCE, MATT-374, removing author link from detail listing
		// author
		//var author = "&nbsp;";
		//var author_search = "";
		//if(recording.dcCreator) {
		//  author = "by " + recording.dcCreator;
		//  author_search = recording.dcCreator.replace(" ", "+");
		//}
		//var divResultAuthorText = document.createElement('div');
		//divResultAuthorText.id = rootID+"_text_author_container";
		//divResultAuthorText.className = "recordings_entry_text_author_container";
		//var authorResultText = document.createElement('a');
		//authorResultText.setAttribute("tabindex", "-1");
		//authorResultText.id = rootID+"_text_title";
		//authorResultText.innerHTML = author;
		//authorResultText.className = "recordings_entry_text_title";
		//if (author_search != "") {
		//	authorResultText.href = "?q=" + author_search;
		//}
		//divResultAuthorText.appendChild(authorResultText);
		//divResultText.appendChild(divResultAuthorText);
		// end #DCE

		// date time
		//var timeDate = recording.mediapackage.start;
		var timeDate = recording.dcCreated;
		if (timeDate) {
			var offsetHours = parseInt(timeDate.substring(20, 22), 10);
			var offsetMinutes = parseInt(timeDate.substring(23, 25), 10);
			if (timeDate.substring(19,20) == "-") {
			  offsetHours = - offsetHours;
			  offsetMinutes = - offsetMinutes;
			}
			var sd = new Date();
			sd.setUTCFullYear(parseInt(timeDate.substring(0, 4), 10));
			sd.setUTCMonth(parseInt(timeDate.substring(5, 7), 10) - 1);
			sd.setUTCDate(parseInt(timeDate.substring(8, 10), 10));
			sd.setUTCHours(parseInt(timeDate.substring(11, 13), 10) - offsetHours);
			sd.setUTCMinutes(parseInt(timeDate.substring(14, 16), 10) - offsetMinutes);
			sd.setUTCSeconds(parseInt(timeDate.substring(17, 19), 10));
			timeDate = sd.toLocaleString();
		} else {
			timeDate = "n.a.";
		}


		var divResultDateText = document.createElement('div');
		divResultDateText.id = rootID+"_text_date";
		divResultDateText.className = "recordings_entry_text_date";
		divResultDateText.innerHTML = timeDate;
		divResultText.appendChild(divResultDateText);

		divEntry.appendChild(divResultText);

		divEntry.setAttribute("tabindex","10000");
		$(divEntry).keyup(function(event) {
			if (event.keyCode == 13) { window.location.href="watch.html?id=" + recording.id; }
		});
		
		divEntry.setAttribute('alt', "");
		divEntry.setAttribute('title', recording.dcTitle);
		divEntry.setAttribute('aria-label', recording.dcTitle);
		
		return divEntry;
	}

});

/*** File: paella-matterhorn/plugins/edu.harvard.dce.infoButtonPlugin/dce_infobutton.js ***/
Class ('paella.plugins.InfoPlugin', paella.ButtonPlugin,{
  getAlignment: function () { return 'right'; },
  getSubclass: function () { return "showInfoPluginButton"; },
  getIndex: function () { return 501; },
  getMinWindowSize: function () { return 300; },
  getName: function () { return "edu.harvard.dce.paella.infoPlugin"; },
  checkEnabled: function (onSuccess) { onSuccess(true); },
  getDefaultToolTip: function () {
    return paella.dictionary.translate("Help and Information about this page");
  },
  getButtonType:function() { return paella.ButtonPlugin.type.popUpButton; },

  buildContent: function (domElement) {
    var thisClass = this;

    var popUp = jQuery('<div id="dce-info-popup"></div>');
    var buttonActions =[ 'Help with this player', 'Report a problem', 'Feedback', 'All Course Videos' ];

    buttonActions.forEach(function(item){
      jQuery(popUp).append(thisClass.getItemButton(item));
    });
    jQuery(domElement).append(popUp);
  },

  getItemButton: function (buttonAction) {
    var thisClass = this;
    var elem = jQuery('<div />');
    jQuery(elem).attr({class: 'infoItemButton'}).text(buttonAction);
    jQuery(elem).click(function (event) {
      thisClass.onItemClick(buttonAction);
    });
    return elem;
  },

  onItemClick: function (buttonAction) {
    switch (buttonAction) {
      case ('Help with this player'):
        location.href = 'watchAbout.shtml';
        break;
      case ('Report a problem'):
        var paramsP = 'ref=' + this.getVideoUrl() + '&server=MH';
        if (paella.matterhorn && paella.matterhorn.episode) {
          paramsP += paella.matterhorn.episode.dcIsPartOf ? '&offeringId=' + paella.matterhorn.episode.dcIsPartOf : '';
          paramsP += paella.matterhorn.episode.dcType ? '&typeNum=' + paella.matterhorn.episode.dcType : '';
          paramsP += paella.matterhorn.episode.dcContributor ? '&ps=' + paella.matterhorn.episode.dcContributor : '';
          paramsP += paella.matterhorn.episode.dcCreated ? '&cDate=' + paella.matterhorn.episode.dcCreated : '';
          paramsP += paella.matterhorn.episode.dcSpatial ? '&cAgent=' + paella.matterhorn.episode.dcSpatial : '';
        }
        window.open('http://cm.dce.harvard.edu/forms/report.shtml?' + paramsP);
        break;
      case ('Feedback'):
        var params = 'ref=' + this.getVideoUrl() + '&server=MH';
        if (paella.matterhorn && paella.matterhorn.episode) {
          params += paella.matterhorn.episode.dcIsPartOf ? '&offeringId=' + paella.matterhorn.episode.dcIsPartOf : '';
          params += paella.matterhorn.episode.dcType ? '&typeNum=' + paella.matterhorn.episode.dcType : '';
          params += paella.matterhorn.episode.dcContributor ? '&ps=' + paella.matterhorn.episode.dcContributor : '';
          params += paella.matterhorn.episode.dcCreated ? '&cDate=' + paella.matterhorn.episode.dcCreated : '';
          params += paella.matterhorn.episode.dcSpatial ? '&cAgent=' + paella.matterhorn.episode.dcSpatial : '';
        }
        window.open('http://cm.dce.harvard.edu/forms/feedback.shtml?' + params);
        break;
      case ('All Course Videos'):
        if (paella.matterhorn && paella.matterhorn.episode && paella.matterhorn.episode.dcIsPartOf){
          var seriesId = paella.matterhorn.episode.dcIsPartOf;
          // MATT-1373 reference combined pub list page when series looks like the DCE <academicYear><term><crn>
          if (seriesId.toString().match('^[0-9]{11}$')) {
            var academicYear = seriesId.toString().slice(0,4);
            var academicTerm = seriesId.toString().slice(4,6);
            var courseCrn = seriesId.toString().slice(6,11);
            location.href = '../ui/index.html#/' + academicYear + '/' + academicTerm + '/' + courseCrn;
          } else {
             // For an unknown series signature, reference the old 1.4x MH only, pub list page
             location.href = '../ui/publicationListing.shtml?seriesId=' + seriesId;
          }
        } 
        else {
          message = 'No other lectures found.';
          paella.messageBox.showMessage(message);
        }
    }
    paella.events.trigger(paella.events.hidePopUp, {
      identifier: this.getName()
    });
  },

  getVideoUrl: function () {
    return document.location.href;
  }
});

paella.plugins.infoPlugin = new paella.plugins.InfoPlugin();

/*** File: paella-matterhorn/plugins/es.upv.paella.matterhorn.descriptionPlugin/mh_description.js ***/
paella.plugins.MHDescriptionPlugin  = Class.create(paella.TabBarPlugin,{
	domElement:null,
	desc: { date:'-', contributor:'-', language:'-', views:'-', serie:'-', serieId:'', presenter:'-', description:'-', title:'-', subject:'-' },
	
	
	getSubclass:function() { return "showMHDescriptionTabBar"; },
	getName:function() { return "es.upv.paella.matterhorn.descriptionPlugin"; },
	getTabName:function() { return paella.dictionary.translate("Description"); },
	getIndex:function() { return 10; },
	getDefaultToolTip:function() { return paella.dictionary.translate("Description"); },	
	

	buildContent:function(domElement) {
		this.domElement = domElement;
		this.loadContent();
	},
			
	action:function(tab) {},
			
	loadContent:function() {
		var thisClass = this;

		if (paella.matterhorn.episode.dcTitle) { this.desc.title = paella.matterhorn.episode.dcTitle; }
		if (paella.matterhorn.episode.dcCreator) { this.desc.presenter = paella.matterhorn.episode.dcCreator; }
		if (paella.matterhorn.episode.dcContributor) { this.desc.contributor = paella.matterhorn.episode.dcContributor; }
		if (paella.matterhorn.episode.dcDescription) { this.desc.description = paella.matterhorn.episode.dcDescription; }
		if (paella.matterhorn.episode.dcLanguage) { this.desc.language = paella.matterhorn.episode.dcLanguage; }
		if (paella.matterhorn.episode.dcSubject) { this.desc.subject = paella.matterhorn.episode.dcSubject; }
		if (paella.matterhorn.serie) {
			// paella.matterhorn.serie['http://purl.org/dc/terms/'];
			if (paella.matterhorn.serie) {
				var serie = paella.matterhorn.serie['http://purl.org/dc/terms/'];
				if (serie) { 
					this.desc.serie = serie.title[0].value; 
					this.desc.serieId = serie.identifier[0].value; 
				}
			}
		}
		this.desc.date = "n.a.";
		var dcCreated = paella.matterhorn.episode.dcCreated;
		if (dcCreated) {			
			var sd = new Date();
			sd.setFullYear(parseInt(dcCreated.substring(0, 4), 10));
			sd.setMonth(parseInt(dcCreated.substring(5, 7), 10) - 1);
			sd.setDate(parseInt(dcCreated.substring(8, 10), 10));
			sd.setHours(parseInt(dcCreated.substring(11, 13), 10));
			sd.setMinutes(parseInt(dcCreated.substring(14, 16), 10));
			sd.setSeconds(parseInt(dcCreated.substring(17, 19), 10));
			this.desc.date = sd.toLocaleString();
		}

		// TODO!
		// #DCE orig, uncomment when stats endpoint is back in DCE MH repo
		// paella.ajax.get({url:'/usertracking/stats.json', params:{id:paella.matterhorn.episode.id}},
		//	function(data, contentType, returnCode) {
		//		thisClass.desc.views = data.stats.views;
		//		thisClass.insertDescription();
		//	},
		//	function(data, contentType, returnCode) {
		//	}
		//);
		// #DCE delete following when stats endpoint is back
		thisClass.desc.views = "";
		thisClass.insertDescription();
		// #DCE end
	},

	insertDescription:function() {
		var divDate = document.createElement('div'); divDate.className = 'showMHDescriptionTabBarElement';
		var divContributor = document.createElement('div'); divContributor.className = 'showMHDescriptionTabBarElement';
		var divLanguage = document.createElement('div'); divLanguage.className = 'showMHDescriptionTabBarElement';
		var divViews = document.createElement('div'); divViews.className = 'showMHDescriptionTabBarElement';
		var divTitle = document.createElement('div'); divTitle.className = 'showMHDescriptionTabBarElement';
		var divSubject = document.createElement('div'); divSubject.className = 'showMHDescriptionTabBarElement';
		var divSeries = document.createElement('div'); divSeries.className = 'showMHDescriptionTabBarElement';
		var divPresenter = document.createElement('div'); divPresenter.className = 'showMHDescriptionTabBarElement';
		var divDescription = document.createElement('div'); divDescription.className = 'showMHDescriptionTabBarElement';

		divDate.innerHTML = paella.dictionary.translate("Date:")+'<span class="showMHDescriptionTabBarValue">'+this.desc.date+'</span>';
		divContributor.innerHTML = paella.dictionary.translate("Contributor:")+'<span class="showMHDescriptionTabBarValue">'+this.desc.contributor+'</span>';
		divLanguage.innerHTML = paella.dictionary.translate("Language:")+'<span class="showMHDescriptionTabBarValue">'+this.desc.language+'</span>';
		divViews.innerHTML = paella.dictionary.translate("Views:")+'<span class="showMHDescriptionTabBarValue">'+this.desc.views+'</span>';			
		divTitle.innerHTML = paella.dictionary.translate("Title:")+'<span class="showMHDescriptionTabBarValue">'+this.desc.title+'</span>';
		divSubject.innerHTML = paella.dictionary.translate("Subject:")+'<span class="showMHDescriptionTabBarValue">'+this.desc.subject+'</span>';
		// #DCE MATT-374, link to DCE MH publication listing, no link for presenter offerings (student cannot cross access)
		divPresenter.innerHTML = paella.dictionary.translate("Presenter:")+'<span class="showMHDescriptionTabBarValue">'+this.desc.presenter+'</span>';
		divSeries.innerHTML = paella.dictionary.translate("Series:")+'<span class="showMHDescriptionTabBarValue"><a tabindex="4002" href="' + paella.player.config.restServer.url + 'engage/ui/publicationListing.shtml?seriesId='+this.desc.serieId+'">'+this.desc.serie+'</a></span>';
		//divPresenter.innerHTML = paella.dictionary.translate("Presenter:")+'<span class="showMHDescriptionTabBarValue"><a tabindex="4001" href="index.html?q='+this.desc.presenter+'">'+this.desc.presenter+'</a></span>';
		//divSeries.innerHTML = paella.dictionary.translate("Series:")+'<span class="showMHDescriptionTabBarValue"><a tabindex="4002" href="index.html?series='+this.desc.serieId+'">'+this.desc.serie+'</a></span>';
		divDescription.innerHTML = paella.dictionary.translate("Description:")+'<span class="showMHDescriptionTabBarValue">'+this.desc.description+'</span>';

		//---------------------------//			
		var divLeft = document.createElement('div'); 			
		divLeft.className = 'showMHDescriptionTabBarLeft';
		
		divLeft.appendChild(divTitle);
		divLeft.appendChild(divPresenter);
		divLeft.appendChild(divSeries);
		divLeft.appendChild(divDate);		
		divLeft.appendChild(divViews);
		
		//---------------------------//
		var divRight = document.createElement('div');
		divRight.className = 'showMHDescriptionTabBarRight';

		divRight.appendChild(divContributor);
		divRight.appendChild(divSubject);
		divRight.appendChild(divLanguage);
		divRight.appendChild(divDescription);

		this.domElement.appendChild(divLeft);
		// #DCE comment out contributor (producer), language (epsidode lang), subject (episode), description (keywords?)
		// this.domElement.appendChild(divRight);

	}
	
});



paella.plugins.mhDescriptionPlugin = new paella.plugins.MHDescriptionPlugin();


/*** File: paella-matterhorn/plugins/es.upv.paella.matterhorn.downloadsPlugin/mh_downloads.js ***/
paella.plugins.DownloadsPlugin = Class.create(paella.TabBarPlugin,{
	getSubclass:function() { return 'downloadsTabBar'; },
	getName:function() { return 'es.upv.paella.matterhorn.downloadsPlugin'; },
	getTabName:function() { return paella.dictionary.translate('Downloads'); },
	getIndex:function() { return 30; },
	getDefaultToolTip:function() { return paella.dictionary.translate('Downloads'); },	
	
			
	domElement:null,
			
	checkEnabled:function(onSuccess) {
		onSuccess(true);
	},

	setup:function() {
		var mimeDict = {
			'video/avi':'AVI',
			'video/mp4':'MP4',
			'video/ogg':'OGG',
			'audio/mp3':'MP3',
			'audio/m4a':'M4A'
		};
		paella.dictionary.addDictionary(mimeDict);


		if (paella.utils.language()=="es") {
			var esDict = {
				'Downloads':'Descargas',			
				'Video file':'Fichero de video',
				'Audio file':'Fichero de audio',
			};
			paella.dictionary.addDictionary(esDict);
		}
	},
	buildContent:function(domElement) {
		this.domElement = domElement;
		this.loadContent();
	},
				
	action:function(tab) {
	},
					
	loadContent:function() {
		var container = document.createElement('div');
		container.className = 'downloadsTabBarContainer';

		
		var tracks = paella.matterhorn.episode.mediapackage.media.track;
		if (!(tracks instanceof Array)) { tracks = [tracks]; }
		
		for (var i=0; i<tracks.length; ++i) {
			var track = tracks[i];
			paella.debug.log(track.type);
			container.appendChild(this.createLink(track, i));
		}
		this.domElement.appendChild(container);
	},
	
	createLink:function(track, tabindexcount) {
		var elem = document.createElement('div');
		elem.className = 'downloadsLinkContainer';
		var link = document.createElement('a');
		link.className = 'downloadsLinkItem';
		link.innerHTML = this.getTextInfo(track);
		link.setAttribute('tabindex', 4000+tabindexcount);
		link.href = track.url;
		
		elem.appendChild(link);
		
		return elem;
	},
	
	getTextInfo:function(track){
		var text = '';
		
		if (track.video) {
			text = '<span class="downloadLinkText TypeFile Video">' + paella.dictionary.translate('Video file') + '</span>';
		}
		else if (track.audio){
			text = '<span class="downloadLinkText TypeFile Audio">' + paella.dictionary.translate('Audio file') + '</span>';
		}
		// track
		var trackText= '<span class="downloadLinkText Track">' + track.type + '</span>';
		
		// Resolution
		var resolution = '';
		if (track.video) {
			if ( track.video.resolution){
				resolution = track.video.resolution;
			}
			if (track.video.framerate){
				resolution +=  '@' + track.video.framerate + 'fps'; 
			}
		}
		
		// mimetype
		var mimetype = '';
		if (track.mimetype) {
			mimetype = track.mimetype;
		}
	
		if (mimetype)
			text += ' <span class="downloadLinkText MIMEType">[' + paella.dictionary.translate(mimetype) + ']' + '</span>';
		text += ': ' + trackText;
		if (resolution)
			text += ' <span class="downloadLinkText Resolution">(' + resolution + ')' + '</span>';
	
		return text;
	}
});
  

paella.plugins.downloadsPlugin = new paella.plugins.DownloadsPlugin();





paella.plugins.DownloadsEditorPlugin = Class.create(paella.editor.RightBarPlugin,{
	getSubclass:function() { return 'editorDownloadsTabBar'; },
	getName:function() { return 'es.upv.paella.matterhorn.editor.downloadsPlugin'; },
	getTabName:function() { return paella.dictionary.translate('Downloads'); },
	getIndex:function() { return 10001; },
	getDefaultToolTip:function() { return paella.dictionary.translate('Downloads'); },	
	
			
			
	checkEnabled:function(onSuccess) {
		onSuccess(true);
	},

	setup:function() {
		var mimeDict = {
			'video/avi':'AVI',
			'video/mp4':'MP4',
			'video/ogg':'OGG',
			'audio/mp3':'MP3',
			'audio/m4a':'M4A'
		};
		paella.dictionary.addDictionary(mimeDict);


		if (paella.utils.language()=="es") {
			var esDict = {
				'Downloads':'Descargas',
				'Video file':'Fichero de video',
				'Audio file':'Fichero de audio',
			};
			paella.dictionary.addDictionary(esDict);
		}
	},
	
		
	getContent:function() {	
		var root = document.createElement('div');
		root.className = "downloadsEditorTabBarContainer";

		var container = document.createElement('div');
		container.className = 'downloadsTabBarContainer';

		var tracks = paella.matterhorn.episode.mediapackage.media.track;
		if (!(tracks instanceof Array)) { tracks = [tracks]; }
		
		for (var i=0; i<tracks.length; ++i) {
			var track = tracks[i];
			paella.debug.log(track.type);
			container.appendChild(this.createLink(track, i));
		}
		
		root.appendChild(container);
		return root;
	},
	
	createLink:function(track, tabindexcount) {
		var elem = document.createElement('div');
		elem.className = 'downloadsLinkContainer';
		var link = document.createElement('a');
		link.className = 'downloadsLinkItem';
		link.innerHTML = this.getTextInfo(track);
		link.setAttribute('tabindex', 4000+tabindexcount);
		link.href = track.url;
		
		elem.appendChild(link);
		
		return elem;
	},
	
	getTextInfo:function(track){
		var text = '';
		
		if (track.video) {
			text = '<span class="downloadLinkText TypeFile Video">' + paella.dictionary.translate('Video file') + '</span>';
		}
		else if (track.audio){
			text = '<span class="downloadLinkText TypeFile Audio">' + paella.dictionary.translate('Audio file') + '</span>';
		}
		// track
		var trackText= '<span class="downloadLinkText Track">' + track.type + '</span>';
		
		// Resolution
		var resolution = '';
		if (track.video) {
			if ( track.video.resolution){
				resolution = track.video.resolution;
			}
			if (track.video.framerate){
				resolution +=  '@' + track.video.framerate + 'fps'; 
			}
		}
		
		// mimetype
		var mimetype = '';
		if (track.mimetype) {
			mimetype = track.mimetype;
		}
	
		if (mimetype)
			text += ' <span class="downloadLinkText MIMEType">[' + paella.dictionary.translate(mimetype) + ']' + '</span>';
		text += ': ' + trackText;
		if (resolution)
			text += ' <span class="downloadLinkText Resolution">(' + resolution + ')' + '</span>';
	
		return text;
	}	
	
});

paella.plugins.downloadsEditorPlugin = new paella.plugins.DownloadsEditorPlugin();



/*** File: paella-matterhorn/plugins/es.upv.paella.matterhorn.editor.SingleVideoExportEditorPlugin/mh_single_video_export.js ***/
paella.plugins.SingleVideoExportEditorPlugin = Class.create(paella.editor.TrackPlugin,{
	tracks:[],
	metadata: null,
	sent: null,
	inprogress: null,
	tabContainer: null,
	
	selectedTrackItem:null,
	
	
	strings: {
		ToEditHeader1: 'This tool exports a new video. It is required that you set the new Title, the Author and the Series in which that video will be located.',
		ToEditHeader2: 'Please select the area you want to export by clicking on the Create button. You can select multiple parts of the video.',
		
		SentToProcess1: 'You have requested to export a new video from this. Your request will comply as soon as possible.',
		SentToProcess2: 'If you wish, you can cancel this video export.',
		
		InProgress1: "The video was sent to be processed. When finished you can display the processed video on the following link.",
		InProgress2: "If you want, you can start a new video export."
	},
	
	isSentToProccess: function() {
		return this.sent != null;
	},
	isInProgress: function() {
		return this.inprogress != null;
	},
	
	
	checkEnabled:function(onSuccess) {
		this.onRead(function(){onSuccess(true);});		
	},

	setup:function() {
		var thisClass = this;
		if (paella.utils.language()=="es") {
			var esDict = {
				'Title':'Título',
				'Presenter':'Ponente',
				'Series': 'Serie',
				'Join Tracks?': '¿Unir los tracks?',
				'Single Video 1': 'Video 1',
				'Single Video Export': 'Exportar un video',
				'Can not create a new video segment inside a segment': 'No se puede crear un nuevo segmento de video dentro de un segmento',
				'Send': 'Enviar',
				'Cancel': 'Cancelar',
				'New Video Export': 'Nueva exportación',
				'An error has occurred': 'Ha ocurrido un error'
			};
			
			esDict[thisClass.strings.ToEditHeader1] = 'Esta herramienta puede exportar nuevos videos. Es necesario que especifiques el nuevo titulo, autor y la serie.';			
			esDict[thisClass.strings.ToEditHeader2] = 'Por favor, selecciona el area que quieras exportar pulsando el boton de "Crear". Puedes seleccionar multiples partes del video.';
			esDict[thisClass.strings.SentToProcess1] = 'Ha solicitado exportar un nuevo video a partir de este. La direccion de este video la tendrá disponible en un periodo de 24h en esta misma pantalla.';
			esDict[thisClass.strings.SentToProcess2] = 'Si lo desea puede cancelar la exportación.';
			esDict[thisClass.strings.InProgress1] = 'El video se envió a procesar. Cuando termine de procesarse podrá visualizarlo en el siguiente enlace.';
			esDict[thisClass.strings.InProgress2] = 'Si lo desea puede empezar una nueva exportación.';
			
			paella.dictionary.addDictionary(esDict);
		}
		if (this.metadata == null) {
			var creator = '';
			var serieId = '';
			var serieTitle = '';
			
			if (paella.matterhorn.serie) {					
				serieId = paella.matterhorn.serie['http://purl.org/dc/terms/'].identifier[0].value;
				serieTitle = paella.matterhorn.serie['http://purl.org/dc/terms/'].identifier[0].value;
			}
			if ( (paella.matterhorn.episode.mediapackage.creators) && (paella.matterhorn.episode.mediapackage.creators.creator) ) {
				creator = paella.matterhorn.episode.mediapackage.creators.creator;
			}
			
			this.metadata = {
				title: paella.dictionary.translate('Single Video 1'),
				presenter: creator,
				serieId: serieId,
				serieTitle: serieTitle				
			};
		}
	},

	getTrackItems:function() {
		return this.tracks;
	},
	
	getTools:function() {
		return [
			{name:'create',label:paella.dictionary.translate('Create'),hint:paella.dictionary.translate('Create a new track item in the current position')},
			{name:'delete',label:paella.dictionary.translate('Delete'),hint:paella.dictionary.translate('Delete selected track item')}
		];
	},
	
	onToolSelected:function(toolName) {
		if (this.isSentToProccess()){
			alert(paella.dictionary.translate('You can not modify the video export settings'));		
		}
		else if (this.isInProgress()){
			alert(paella.dictionary.translate('You can not modify the video export settings'));		
		}
		else{
			switch (toolName) {
				case 'delete':
					if (this.selectedTrackItem) {
						this.tracks.splice(this.tracks.indexOf(this.selectedTrackItem),1);
						paella.events.trigger(paella.events.documentChanged);
						return true;
					}
					break;
					
				case 'create':
					paella.events.trigger(paella.events.documentChanged);								
					if (this.isCurrentPositionInsideATrackItem() == false) {
						var start = paella.player.videoContainer.currentTime();
						var itemDuration  = paella.player.videoContainer.duration()*0.1;
						itemDuration = itemDuration*100/paella.editor.instance.bottomBar.timeline.zoom;
						var end = start + itemDuration; //paella.editor.instance.bottomBar.timeline.zoom
						if (end > paella.player.videoContainer.duration() ) { end = paella.player.videoContainer.duration(); }
						for (var i=0; i<this.tracks.length; ++i) {
							var track = this.tracks[i];
							if ( (track.s>start) && (track.s<end) ) {
								end = track.s;
							}
						}				
						
						var id = this.getTrackUniqueId();
						var content = this.metadata.title;
						this.tracks.push({id:id, s:start, e:end, name:content});
					}
					else{
						alert (paella.dictionary.translate("Can not create a new video segment inside a segment"));
					}
					return true;
			}
		}
	},
		
	isCurrentPositionInsideATrackItem: function(){
		var start = paella.player.videoContainer.currentTime();
		var startInsideTrackItem = false;
		for (var i=0; i<this.tracks.length; ++i) {
			var track = this.tracks[i];
			if ( (track.s<=start) && (start<=track.e) ){
				startInsideTrackItem = true;
				break;
			}
		}
		return startInsideTrackItem;		
	},
	
	isToolEnabled:function(toolName) {
		switch (toolName) {
			case 'create': 
				return (this.isCurrentPositionInsideATrackItem() == false); 
				
			case 'delete': 
				if (this.selectedTrackItem)
					return true;
				break;
				
			default:
				return true;
		}
		return false;		
	},
	
	createALabel: function(label) {
		var root = document.createElement('div');
		root.innerHTML = label;
		return root;		
	},
	createAInputEditor:function(label, defaultValue, callback){
		var root = document.createElement('div');
		var lab = this.createALabel(label);
		var titleInput = document.createElement('input');
		titleInput.type = "text";
		titleInput.value = defaultValue;
		if (callback) {
			$(titleInput).keyup(function(event){callback(event.srcElement.value);});
		}
		root.appendChild(lab);
		root.appendChild(titleInput);
		
		return root;
	},	
	createASelectSerie: function(label, defaultValue, callback) {		
		var root = document.createElement('div');
		var lab = this.createALabel(label);		


		var typeaheadDiv = document.createElement('div');
		var typeaheadInput = document.createElement('input');
		typeaheadInput.className = "typehead";
		typeaheadInput.type = "text";
		typeaheadInput.value = defaultValue.serieTitle;
		typeaheadInput.setAttribute('serieId',defaultValue.serieId);
		typeaheadInput.setAttribute('serieTitle',defaultValue.serieTitle);
		//typeaheadInput.placeholder = "";


		typeaheadDiv.appendChild(typeaheadInput);

		this.numbers = new Bloodhound({
			datumTokenizer: function(d) {return Bloodhound.tokenizers.whitespace(d.num); },
			queryTokenizer: Bloodhound.tokenizers.whitespace,
			remote: {
				url: '/series/series.json?q=%QUERY',
				filter: function(parsedResponse) {
					return jQuery.map(parsedResponse.catalogs, function (serie){
						var serieId = serie['http://purl.org/dc/terms/'].identifier[0].value;
						var title = serie['http://purl.org/dc/terms/'].title[0].value;						
						return {identifier: serieId, title:title};
					});
				}
			}
		});
		
		this.numbers.initialize();
		
		$(typeaheadInput).typeahead({
			minLength: 2,
			limit: 5,
			highlight: true,
		}, {
			displayKey: 'title',
			source: this.numbers.ttAdapter()
		});


		$(typeaheadInput).change(function(event){
			if (callback) {
				callback(event.currentTarget.getAttribute("serieId"), event.currentTarget.getAttribute("serieTitle"));
			}
		});
		
		$(typeaheadInput).keyup(function(event){
			if (event.currentTarget.getAttribute("typeaheadOpened") == "1"){	
				event.currentTarget.setAttribute("serieId", "");
				event.currentTarget.setAttribute("serieTitle", event.currentTarget.value);
			}
		});
		$(typeaheadInput).bind('typeahead:opened', function(event) {
			event.currentTarget.setAttribute("typeaheadOpened", "1");
	    });
		$(typeaheadInput).bind('typeahead:closed', function(event) {      
			event.currentTarget.setAttribute("typeaheadOpened", "");
	    });

		$(typeaheadInput).bind('typeahead:selected', function(event, datum, name) {
			event.currentTarget.setAttribute("serieId", datum.identifier);
			event.currentTarget.setAttribute("serieTitle", datum.title);
			event.currentTarget.value = datum.title;
			
			if (callback) {
	   			callback(event.currentTarget.getAttribute("serieId"), event.currentTarget.getAttribute("serieTitle"));
	   		}
	    });

		
		root.appendChild(lab);
		root.appendChild(typeaheadDiv);		
		return root;
	},
	
	
	
	
	changeTitle:function(title) {
		this.metadata.title = title;
		for (var i=0;i<this.tracks.length;++i) {
			this.tracks[i].name = title;
		}
		// TODO: Repaint
	},
	
	buildToolTabContentToEdit:function(tabContainer) {
		var thisClass = this;
		var root = document.createElement('div');
		root.id = 'SingleVideoExportEditorTabBarRoot';
		
		var basicMetadata = document.createElement('div');
		
		var header = document.createElement('div');
		var header1 = document.createElement('p');
		var header2 = document.createElement('p');
		header1.innerText = paella.dictionary.translate(this.strings.ToEditHeader1);
		header2.innerText = paella.dictionary.translate(this.strings.ToEditHeader2);
		header.appendChild(header1);
		header.appendChild(header2);
		
		
		root.appendChild(header);
		root.appendChild(basicMetadata);
		basicMetadata.appendChild(this.createAInputEditor(paella.dictionary.translate('Title'), this.metadata.title, function(value){thisClass.changeTitle(value);}));
		basicMetadata.appendChild(this.createAInputEditor(paella.dictionary.translate('Presenter'), this.metadata.presenter, function(value){thisClass.metadata.presenter = value;}));
		basicMetadata.appendChild(this.createASelectSerie(paella.dictionary.translate('Series'), this.metadata, function(serieId, serieTitle){
			thisClass.metadata.serieId = serieId;
			thisClass.metadata.serieTitle = serieTitle;
		}));
		
		
		var sendDiv = document.createElement('div');
		sendDiv.className = "btn-group";
		root.appendChild(sendDiv);
		var sendButton = document.createElement('button');
		sendButton.className = "btn";
		sendButton.innerHTML = paella.dictionary.translate('Send');
		$(sendButton).click(function(event){
			while (thisClass.tabContainer.firstChild) {
				thisClass.tabContainer.removeChild(thisClass.tabContainer.firstChild);
			}

			thisClass.sent = true;
			thisClass.onSave(function(success){
				if (success == true){
					thisClass.buildToolTabContent(thisClass.tabContainer);
				}
				else {
					thisClass.sent = null;
					alert(paella.dictionary.translate('An error has occurred'));
				}			
			});
		});
		sendDiv.appendChild(sendButton);		
		
		tabContainer.appendChild(root);
	},

	buildToolTabContentSentToProcess:function(tabContainer) {
		var thisClass = this;
		var root = document.createElement('div');
		root.id = 'SingleVideoExportEditorTabBarRoot';

		var info = document.createElement('div');
		info.id = "SingleVideoExportEditorTabBarRoot_ToProcess";
		
		var text = document.createElement('p');
		text.innerText = paella.dictionary.translate(this.strings.SentToProcess1);

		var text2 = document.createElement('p');
		text2.innerText = paella.dictionary.translate(this.strings.SentToProcess2);


		var buttonBar = document.createElement('div');
		buttonBar.className = "btn-group";
		
		var cancelButton = document.createElement('button');
		cancelButton.className = "btn";
		cancelButton.innerHTML = paella.dictionary.translate('Cancel');
		$(cancelButton).click(function(event){
			while (thisClass.tabContainer.firstChild) {
				thisClass.tabContainer.removeChild(thisClass.tabContainer.firstChild);
			}
			var oldSent = thisClass.sent;
			thisClass.sent = null;
			thisClass.onSave(function(success){
				if (success == true){
					thisClass.buildToolTabContent(thisClass.tabContainer);
				}
				else {
					thisClass.sent = oldSent;
					alert(paella.dictionary.translate('An error has occurred'));
				}
			});
		});

		
		info.appendChild(text);
		info.appendChild(text2);
		info.appendChild(buttonBar);
		buttonBar.appendChild(cancelButton);
		
		root.appendChild(info);
		tabContainer.appendChild(root);

	},
	
	buildToolTabContentInProgress:function(tabContainer) {
		var thisClass = this;
		var root = document.createElement('div');
		root.id = 'SingleVideoExportEditorTabBarRoot';

		var info = document.createElement('div');
		info.id = "SingleVideoExportEditorTabBarRoot_InProgress";
		
		var text = document.createElement('p');
		text.innerText = paella.dictionary.translate(this.strings.InProgress1);

		var link = "watch.html?id=" + this.inprogress.id;
		var videoLink = document.createElement('a');
		videoLink.href = link;
		videoLink.innerText = this.inprogress.title;

		var list = document.createElement('ul');
		var elist = document.createElement('li');

		list.appendChild(elist);
		elist.appendChild(videoLink);

		var text2 = document.createElement('p');
		text2.innerText = paella.dictionary.translate(this.strings.InProgress2);

		var buttonBar = document.createElement('div');
		buttonBar.className = "btn-group";

		var cancelButton = document.createElement('button');
		cancelButton.className = "btn";		
		cancelButton.innerHTML = paella.dictionary.translate('New Video Export');
		$(cancelButton).click(function(event){
			while (thisClass.tabContainer.firstChild) {
				thisClass.tabContainer.removeChild(thisClass.tabContainer.firstChild);
			}
			var olsInprogress = thisClass.inprogress;
			thisClass.inprogress = null;
			thisClass.onSave(function(success){
				if (success == true){
					thisClass.tracks = [];
					paella.events.trigger(paella.events.documentChanged);
					paella.editor.instance.bottomBar.timeline.rebuildTrack(thisClass.getName());
					paella.editor.pluginManager.onTrackChanged(thisClass);
					paella.editor.instance.rightBar.updateCurrentTab();					
				}
				else {
					thisClass.inprogress = oldInprogress;
					alert(paella.dictionary.translate('An error has occurred'));
				}			
			});
		});

		
		info.appendChild(text);
		info.appendChild(list);
		info.appendChild(text2);
		info.appendChild(buttonBar);
		buttonBar.appendChild(cancelButton);
		
		root.appendChild(info);
		tabContainer.appendChild(root);
	},
	
	buildToolTabContent:function(tabContainer) {
		this.tabContainer = tabContainer;
		
		if (this.isSentToProccess()){
			this.buildToolTabContentSentToProcess(tabContainer);
		}
		else if (this.isInProgress()){
			this.buildToolTabContentInProgress(tabContainer);
		}
		else{	
			this.buildToolTabContentToEdit(tabContainer);
		}
	},
	
	getTrackUniqueId:function() {
		var newId = -1;
		if (this.tracks.length==0) return 1;
		for (var i=0;i<this.tracks.length;++i) {
			if (newId<=this.tracks[i].id) {
				newId = this.tracks[i].id + 1;
			}
		}
		return newId;
	},
	
	getName:function() {
		return "es.upv.paella.matterhorn.editor.SingleVideoExportEditorPlugin";
	},
	
	getTrackName:function() {
		return paella.dictionary.translate("Single Video Export");
	},
	
	getColor:function() {
		return 'rgb(176, 214, 118)';
	},
	
	getTextColor:function() {
		return 'rgb(90,90,90)';
	},
	
	onTrackChanged:function(id,start,end) {
		if (this.isSentToProccess() || this.isInProgress()){
			return;
		}
	
		var joinTracks = true;
		paella.events.trigger(paella.events.documentChanged);
		var item = this.getTrackItem(id);
		this.selectedTrackItem = item;
		if (item) {
			var i;
			if (start < 0) {start = 0;}
			if (end > paella.player.videoContainer.duration() ) { end = paella.player.videoContainer.duration(); }
			
			//check for cancel
			for (i=0; i<this.tracks.length; ++i) {
				if (this.tracks[i].id != id) {
					if ( (this.tracks[i].s <= start) && (this.tracks[i].e >= end) ){
						return;
					}
					if ( (this.tracks[i].s >= start) && (this.tracks[i].e <= end) ){
						return;
					}
				}
			}

			// check for overlap
			for (i=0; i<this.tracks.length; ++i) {
				if (this.tracks[i].id != id) {
					if ( (this.tracks[i].s < start) && (this.tracks[i].e > start) ){
						if (joinTracks == null) {
							joinTracks = confirm (paella.dictionary.translate("Join Tracks?"));
						}
						if (joinTracks){
							this.tracks[i].e = end;
							this.tracks.splice(this.tracks.indexOf(item), 1);
							return;								
						}
						else{
							start = this.tracks[i].e;
						}
					}
					if ( (this.tracks[i].s < end) && (this.tracks[i].e > end) ){
						if (joinTracks == null) {
							joinTracks = confirm (paella.dictionary.translate("Join Tracks?"));
						}
						if (joinTracks){
							this.tracks[i].s = start;
							this.tracks.splice(this.tracks.indexOf(item), 1);
							return;								
						}
						else {
							end = this.tracks[i].s;
						}
					}	
				}
			
				item.s = start;
				item.e = end;
			}
		}
	},
	
	allowEditContent:function() {
		return false;
	},
	
	getTrackItem:function(id) {
		for (var i=0; i<this.tracks.length; ++i) {
			if (this.tracks[i].id==id) return this.tracks[i];
		}
	},
	
	contextHelpString:function() {
		if (paella.utils.language()=="es") {
			return "";
		}
		else {
			return "";
		}
	},
	
	onRead:function(onComplete) {
		var thisClass = this;
		paella.data.read('SingleVideoExport', {id:paella.initDelegate.getId()}, function(data, status) {
			if (data && typeof(data)=='object') {
				
				if(data.trackItems && data.trackItems.length>0) {
					thisClass.tracks = data.trackItems;
				}
				if(data.metadata) {
					thisClass.metadata = data.metadata;
				}
				if(data.sent) {
					thisClass.sent = data.sent;
				}
				if(data.inprogress) {
					thisClass.inprogress = data.inprogress;
				}
			}			
			
			onComplete(true);
		});

	},
	
	onSave:function(onComplete) {
		var data = {
			trackItems:this.tracks,
			metadata: this.metadata,
			sent: this.sent,
			inprogress: this.inprogress
		};
		paella.data.write('SingleVideoExport',{id:paella.initDelegate.getId()}, data, function(response,status) {
			onComplete(status);
		});		
	}

});

paella.plugins.singleVideoExportEditorPlugin = new paella.plugins.SingleVideoExportEditorPlugin();



/*** File: paella-matterhorn/plugins/es.upv.paella.matterhorn.editor.multipleVideoExportEditorPlugin/mh_multiple_video_export.js ***/
paella.plugins.MultipleVideoExportEditorPlugin = Class.create(paella.editor.TrackPlugin,{
	tracks:[],
	sent: null,
	inprogress: null,
	tabContainer: null,	
	selectedTrackItem:null,
	videoCount: 1,
	
	strings: {
		ToEditHeader1: 'This tool exports new videos. It is required that you set the new Title, the Author and the Series in which those videos will be located.',
		ToEditHeader2: 'Please select the area you want to export by clicking on the Create button. You can select multiple parts of the video. Each part will be exported as a new Video.',
	
		SentToProcess1: 'You have requested to export new videos from this. Your request will comply as soon as possible.',
		SentToProcess2: 'If you wish, you can cancel this video exports.',
		
		InProgress1: "The videos waere sent to be processed. When finished you can display the processed videos on the following links.",
		InProgress2: "If you want, you can start a new video exports."
	},	
	
	
	isSentToProccess: function() {
		return this.sent != null;
	},
	isInProgress: function() {
		return this.inprogress != null;
	},	

	checkEnabled:function(onSuccess) {
		this.onRead(function(){onSuccess(true);});	
	},

	setup:function() {
		if (paella.utils.language()=="es") {
			var esDict = {
				'Title':'Título',
				'Presenter':'Ponente',
				'Series': 'Serie',
				'Video':'Video',
				'Multiple Video Export': 'Exportar multiples videos',
				'Can not create a new video segment inside a segment': 'No se puede crear un nuevo segmento de video dentro de un segmento',
				'Send': 'Enviar',
				'Cancel': 'Cancelar',
				'New Video Export': 'Nueva exportación',
				'An error has occurred': 'Ha ocurrido un error'						
			};
			
			esDict[this.strings.ToEditHeader1] = 'Esta herramienta puede exportar nuevos videos. Es necesario que especifiques el nuevo titulo, autor y la serie de cada uno de estos videos.';			
			esDict[this.strings.ToEditHeader2] = 'Por favor, selecciona el area que quieras exportar pulsando el boton de "Crear". Puedes seleccionar multiples partes del video. Cada una de estas partes se exportarán como un nuevo video.';			
			esDict[this.strings.SentToProcess1] = 'Ha solicitado exportar nuevos videos a partir de este. Las direcciones de estos videos las tendrá disponibles en un periodo de 24h en esta misma pantalla.';
			esDict[this.strings.SentToProcess2] = 'Si lo desea puede cancelar la exportación de videos.';
			esDict[this.strings.InProgress1] = 'Los videos se han enviado a procesar. Cuando terminen de procesarse podrá visualizarlos en los siguiente enlaces.';
			esDict[this.strings.InProgress2] = 'Si lo desea puede empezar una nueva exportación.';
			
			paella.dictionary.addDictionary(esDict);
		}
	},

	getTrackItems:function() {
		return this.tracks;
	},
	
	getTools:function() {
		return [
			{name:'create',label:paella.dictionary.translate('Create'),hint:paella.dictionary.translate('Create a new track in the current position')},
			{name:'delete',label:paella.dictionary.translate('Delete'),hint:paella.dictionary.translate('Delete selected track')}
		];
	},
	
	onToolSelected:function(toolName) {
		if (this.isSentToProccess()){
			alert(paella.dictionary.translate('You can not modify the video export settings'));		
		}
		else if (this.isInProgress()){
			alert(paella.dictionary.translate('You can not modify the video export settings'));		
		}
		else{	
			switch (toolName) {
				case 'delete':
					if (this.selectedTrackItem) {
						paella.events.trigger(paella.events.documentChanged);
						this.tracks.splice(this.tracks.indexOf(this.selectedTrackItem),1);
						return true;
					}
					break;			
				case 'create':
					paella.events.trigger(paella.events.documentChanged);								
					var start = paella.player.videoContainer.currentTime();
					var itemDuration  = paella.player.videoContainer.duration()*0.1;
					itemDuration = itemDuration*100/paella.editor.instance.bottomBar.timeline.zoom;
					var end = start + itemDuration;
					if (end > paella.player.videoContainer.duration() ) { end = paella.player.videoContainer.duration(); }
					for (var i=0; i<this.tracks.length; ++i) {
						var track = this.tracks[i];
						if ( (track.s>start) && (track.s<end) ) {
							end = track.s;
						}
					}				
					
					var id = this.getTrackUniqueId();
					var creator = '';
					var serieId = '';
					var serieTitle = '';

					if (paella.matterhorn.serie) {					
						serieId = paella.matterhorn.serie['http://purl.org/dc/terms/'].identifier[0].value;
						serieTitle = paella.matterhorn.serie['http://purl.org/dc/terms/'].identifier[0].value;
					}
					if ( (paella.matterhorn.episode.mediapackage.creators) && (paella.matterhorn.episode.mediapackage.creators.creator) ) {
						creator = paella.matterhorn.episode.mediapackage.creators.creator;
					}
					
					var metadata = {
						title: paella.dictionary.translate('Video') + ' ' + this.videoCount,
						presenter: creator,
						serieId: serieId,
						serieTitle: serieTitle
					};
					this.videoCount = this.videoCount +1;
					this.tracks.push({id:id, s:start, e:end, name:metadata.title, metadata: metadata});
					this.selectedTrackItem = this.getTrackItem(id);
					return true;
			}
		}
	},
	
	isCurrentPositionInsideATrackItem: function(){
		var start = paella.player.videoContainer.currentTime();
		var startInsideTrackItem = false;
		for (var i=0; i<this.tracks.length; ++i) {
			var track = this.tracks[i];
			if ( (track.s<=start) && (start<=track.e) ){
				startInsideTrackItem = true;
				break;
			}
		}
		return startInsideTrackItem;		
	},
	
	isToolEnabled:function(toolName) {
		switch (toolName) {
			case 'create': 
				return (this.isCurrentPositionInsideATrackItem() == false); 
				
			case 'delete': 
				if (this.selectedTrackItem)
					return true;
				break;
				
			default:
				return true;
		}
		return false;		
	},	
	
	createALabel: function(label) {
		var root = document.createElement('div');
		root.innerHTML = label;
		return root;		
	},
	createAInputEditor:function(label, defaultValue, callback){
		var root = document.createElement('div');
		var lab = this.createALabel(label);
		var titleInput = document.createElement('input');
		titleInput.type = "text";
		titleInput.value = defaultValue;
		if (callback) {
			$(titleInput).keyup(function(event){callback(event.srcElement.value);});
		}
		root.appendChild(lab);
		root.appendChild(titleInput);
		
		return root;
	},	
	createASelectSerie: function(label, defaultValue, callback) {		
		var root = document.createElement('div');
		var lab = this.createALabel(label);		


		var typeaheadDiv = document.createElement('div');
		var typeaheadInput = document.createElement('input');
		typeaheadInput.className = "typehead";
		typeaheadInput.type = "text";
		typeaheadInput.value = defaultValue.serieTitle;
		typeaheadInput.setAttribute('serieId',defaultValue.serieId);
		typeaheadInput.setAttribute('serieTitle',defaultValue.serieTitle);
		//typeaheadInput.placeholder = "";


		typeaheadDiv.appendChild(typeaheadInput);

		this.numbers = new Bloodhound({
			datumTokenizer: function(d) {return Bloodhound.tokenizers.whitespace(d.num); },
			queryTokenizer: Bloodhound.tokenizers.whitespace,
			remote: {
				url: '/series/series.json?q=%QUERY',
				filter: function(parsedResponse) {
					return jQuery.map(parsedResponse.catalogs, function (serie){
						var serieId = serie['http://purl.org/dc/terms/'].identifier[0].value;
						var title = serie['http://purl.org/dc/terms/'].title[0].value;						
						return {identifier: serieId, title:title};
					});
				}
			}
		});
		
		this.numbers.initialize();
		
		$(typeaheadInput).typeahead({
			minLength: 2,
			limit: 5,
			highlight: true,
		}, {
			displayKey: 'title',
			source: this.numbers.ttAdapter()
		});


		$(typeaheadInput).change(function(event){
			if (callback) {
				callback(event.currentTarget.getAttribute("serieId"), event.currentTarget.getAttribute("serieTitle"));
			}
		});
		
		$(typeaheadInput).keyup(function(event){
			if (event.currentTarget.getAttribute("typeaheadOpened") == "1"){	
				event.currentTarget.setAttribute("serieId", "");
				event.currentTarget.setAttribute("serieTitle", event.currentTarget.value);
			}
		});
		$(typeaheadInput).bind('typeahead:opened', function(event) {
			event.currentTarget.setAttribute("typeaheadOpened", "1");
	    });
		$(typeaheadInput).bind('typeahead:closed', function(event) {      
			event.currentTarget.setAttribute("typeaheadOpened", "");
	    });

		$(typeaheadInput).bind('typeahead:selected', function(event, datum, name) {
			event.currentTarget.setAttribute("serieId", datum.identifier);
			event.currentTarget.setAttribute("serieTitle", datum.title);
			event.currentTarget.value = datum.title;
			
			if (callback) {
	   			callback(event.currentTarget.getAttribute("serieId"), event.currentTarget.getAttribute("serieTitle"));
	   		}
	    });

		
		root.appendChild(lab);
		root.appendChild(typeaheadDiv);		
		return root;
	},
	
	changeTitle:function(title) {
		this.selectedTrackItem.metadata.title = title;
		this.selectedTrackItem.name = title;
		// TODO: Repaint
	},
	
	
	
	buildToolTabContentToEdit:function(tabContainer) {
		var thisClass = this;
		var root = document.createElement('div');
		root.id = 'MultipleVideoExportEditorTabBarRoot';
		
		
		var header = document.createElement('div');
		var header1 = document.createElement('p');
		var header2 = document.createElement('p');
		header1.innerText = paella.dictionary.translate(this.strings.ToEditHeader1);
		header2.innerText = paella.dictionary.translate(this.strings.ToEditHeader2);
		header.appendChild(header1);
		header.appendChild(header2);		
		root.appendChild(header);
		

		var basicMetadata = document.createElement('div');
		root.appendChild(basicMetadata);
		basicMetadata.appendChild(this.createAInputEditor(paella.dictionary.translate('Title'), this.selectedTrackItem.metadata.title, function(value){thisClass.changeTitle(value);}));
		basicMetadata.appendChild(this.createAInputEditor(paella.dictionary.translate('Presenter'), this.selectedTrackItem.metadata.presenter, function(value){ thisClass.selectedTrackItem.metadata.presenter = value; }));
		basicMetadata.appendChild(this.createASelectSerie(paella.dictionary.translate('Series'), this.selectedTrackItem.metadata, function(serieId, serieTitle){
			thisClass.selectedTrackItem.metadata.serieId = serieId;
			thisClass.selectedTrackItem.metadata.serieTitle = serieTitle;
		}));
		
		
		var sendDiv = document.createElement('div');
		sendDiv.className = "btn-group";
		root.appendChild(sendDiv);
		var sendButton = document.createElement('button');
		sendButton.className = "btn";
		sendButton.innerHTML = paella.dictionary.translate('Send');
		$(sendButton).click(function(event){
			while (thisClass.tabContainer.firstChild) {
				thisClass.tabContainer.removeChild(thisClass.tabContainer.firstChild);
			}

			thisClass.sent = true;
			thisClass.onSave(function(success){
				if (success == true){
					thisClass.buildToolTabContent(thisClass.tabContainer);
				}
				else {
					thisClass.sent = null;
					alert(paella.dictionary.translate('An error has occurred'));
				}			
			});
		});
		sendDiv.appendChild(sendButton);		
		
		tabContainer.appendChild(root);
	},	
	
	buildToolTabContentSentToProcess:function(tabContainer) {
		var thisClass = this;
		var root = document.createElement('div');
		root.id = 'MultipleVideoExportEditorTabBarRoot';

		var info = document.createElement('div');
		info.id = "MultipleVideoExportEditorTabBarRoot_ToProcess";
		
		var text = document.createElement('p');
		text.innerText = paella.dictionary.translate(this.strings.SentToProcess1);

		var text2 = document.createElement('p');
		text2.innerText = paella.dictionary.translate(this.strings.SentToProcess2);


		var buttonBar = document.createElement('div');
		buttonBar.className = "btn-group";
		
		var cancelButton = document.createElement('button');
		cancelButton.className = "btn";
		cancelButton.innerHTML = paella.dictionary.translate('Cancel');
		$(cancelButton).click(function(event){
			while (thisClass.tabContainer.firstChild) {
				thisClass.tabContainer.removeChild(thisClass.tabContainer.firstChild);
			}
			var oldSent = thisClass.sent;
			thisClass.sent = null;
			thisClass.onSave(function(success){
				if (success == true){
					thisClass.buildToolTabContent(thisClass.tabContainer);
				}
				else {
					thisClass.sent = oldSent;
					alert(paella.dictionary.translate('An error has occurred'));
				}
			});
		});
		
		info.appendChild(text);
		info.appendChild(text2);
		info.appendChild(buttonBar);
		buttonBar.appendChild(cancelButton);
		
		root.appendChild(info);
		tabContainer.appendChild(root);

	},	
	
	buildToolTabContentInProgress:function(tabContainer) {
		var thisClass = this;
		var root = document.createElement('div');
		root.id = 'MultipleVideoExportEditorTabBarRoot';

		var info = document.createElement('div');
		info.id = "MultipleVideoExportEditorTabBarRoot_InProgress";
		
		var text = document.createElement('p');
		text.innerText = paella.dictionary.translate(this.strings.InProgress1);

		var list = document.createElement('ul');

		for (var i =0 ; i < this.inprogress.length; ++i) {
			var link = "watch.html?id=" + this.inprogress[i].id;
			var videoLink = document.createElement('a');
			videoLink.href = link;
			videoLink.innerText = this.inprogress[i].title;

			var elist = document.createElement('li');
			list.appendChild(elist);
			elist.appendChild(videoLink);
		}

		var text2 = document.createElement('p');
		text2.innerText = paella.dictionary.translate(this.strings.InProgress2);

		var buttonBar = document.createElement('div');
		buttonBar.className = "btn-group";

		var cancelButton = document.createElement('button');
		cancelButton.className = "btn";		
		cancelButton.innerHTML = paella.dictionary.translate('New Video Export');
		$(cancelButton).click(function(event){
			while (thisClass.tabContainer.firstChild) {
				thisClass.tabContainer.removeChild(thisClass.tabContainer.firstChild);
			}
			var olsInprogress = thisClass.inprogress;
			thisClass.inprogress = null;
			thisClass.onSave(function(success){
				if (success == true){
					thisClass.tracks = [];
					paella.events.trigger(paella.events.documentChanged);
					paella.editor.instance.bottomBar.timeline.rebuildTrack(thisClass.getName());
					paella.editor.pluginManager.onTrackChanged(thisClass);
					paella.editor.instance.rightBar.updateCurrentTab();					
				}
				else {
					thisClass.inprogress = oldInprogress;
					alert(paella.dictionary.translate('An error has occurred'));
				}			
			});
		});
		
		info.appendChild(text);
		info.appendChild(list);
		info.appendChild(text2);
		info.appendChild(buttonBar);
		buttonBar.appendChild(cancelButton);
		
		root.appendChild(info);
		tabContainer.appendChild(root);
	},	
	
	buildToolTabContent:function(tabContainer) {
		this.tabContainer = tabContainer;
		
		if (this.selectedTrackItem){
			if (this.isSentToProccess()){
				this.buildToolTabContentSentToProcess(tabContainer);
			}
			else if (this.isInProgress()){
				this.buildToolTabContentInProgress(tabContainer);
			}
			else{	
				this.buildToolTabContentToEdit(tabContainer);
			}
		}		
	},	

	
	getTrackUniqueId:function() {
		var newId = -1;
		if (this.tracks.length==0) return 1;
		for (var i=0;i<this.tracks.length;++i) {
			if (newId<=this.tracks[i].id) {
				newId = this.tracks[i].id + 1;
			}
		}
		return newId;
	},
	
	getName:function() {
		return "es.upv.paella.matterhorn.editor.MultipleVideoExportEditorPlugin";
	},
	
	getTrackName:function() {
		return paella.dictionary.translate("Multiple Video Export");
	},
	
	getColor:function() {
		return 'rgb(141, 220, 245)';
	},
	
	getTextColor:function() {
		return 'rgb(90,90,90)';
	},
	
	onTrackChanged:function(id,start,end) {
		var joinTracks = null;
		paella.events.trigger(paella.events.documentChanged);
		var item = this.getTrackItem(id);
		this.selectedTrackItem = item;
		if (item) {
			if (start < 0) {start = 0;}
			if (end > paella.player.videoContainer.duration() ) { end = paella.player.videoContainer.duration(); }
			
			item.s = start;
			item.e = end;		
		}
	},
	
	allowEditContent:function() {
		return false;
	},
	
	getTrackItem:function(id) {
		for (var i=0; i<this.tracks.length; ++i) {
			if (this.tracks[i].id==id) return this.tracks[i];
		}
	},
	
	contextHelpString:function() {
		if (paella.utils.language()=="es") {
			return "";
		}
		else {
			return "";
		}
	},
	
	onRead:function(onComplete) {
		var thisClass = this;
		paella.data.read('MultipleVideoExport', {id:paella.initDelegate.getId()}, function(data, status) {
			if (data && typeof(data)=='object') {
				
				if(data.trackItems && data.trackItems.length>0) {
					thisClass.tracks = data.trackItems;
				}
				if(data.sent) {
					thisClass.sent = data.sent;
				}
				if(data.inprogress) {
					thisClass.inprogress = data.inprogress;
				}
			}			
						
			onComplete(true);
		});
	},	
	
	onSave:function(onComplete) {
		var data = {
			trackItems:this.tracks,
			sent: this.sent,
			inprogress: this.inprogress
		};
			
		paella.data.write('MultipleVideoExport',{id:paella.initDelegate.getId()}, data, function(response,status) {
			onComplete(status);
		});			
	}
});

paella.plugins.multipleVideoExportEditorPlugin = new paella.plugins.MultipleVideoExportEditorPlugin();



/*** File: paella-matterhorn/plugins/es.upv.paella.matterhorn.episodesFromSeries/mh_episodes_from_serie.js ***/
paella.plugins.EpisodesFromSerie = Class.create(paella.RightBarPlugin,{
	getSubclass:function() { return 'EpisodesFromSerie'; },

	getName:function() {
		return "es.upv.paella.matterhorn.EpisodesFromSerie";
	},

	buildContent:function(domElement) {
	
		var serieId = paella.matterhorn.episode.mediapackage.series;
		var serieTitle = paella.matterhorn.episode.mediapackage.seriestitle;



		var episodesFromSerieTitle = document.createElement('div');
		episodesFromSerieTitle.id = 'episodesFromSerieTitle';
		episodesFromSerieTitle.className = 'episodesFromSerieTitle';
		if (serieId) {
			episodesFromSerieTitle.innerHTML = "<span class='episodesFromSerieTitle_Bold'>" +paella.dictionary.translate("Videos in this series:")+"</span> " + serieTitle;
		}
		else {
			episodesFromSerieTitle.innerHTML = "<span class='episodesFromSerieTitle_Bold'>" +paella.dictionary.translate("Available videos:")+"</span>";			
		}

		var episodesFromSerieListing = document.createElement('div');
		episodesFromSerieListing.id = 'episodesFromSerieListing';
		episodesFromSerieListing.className = 'episodesFromSerieListing';

	
		domElement.appendChild(episodesFromSerieTitle);
		domElement.appendChild(episodesFromSerieListing);


		var params = {limit:10, page:0, sid:serieId};
		var mySearch = new paella.matterhorn.SearchEpisode(paella.player.config, params);
		mySearch.doSearch(params, document.getElementById('episodesFromSerieListing'));
	}
});

paella.plugins.episodesFromSerie = new paella.plugins.EpisodesFromSerie();
/*** File: paella-matterhorn/plugins/es.upv.paella.matterhorn.publishPlugin/mh_publish.js ***/
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// Loader Publish Plugin
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
paella.plugins.PublishPlugin = Class.create(paella.EventDrivenPlugin,{
		
	getSubclass:function() { return "publishPlugin"; },
	getName:function() { return 'es.upv.paella.matterhorn.publishPlugin'; },
	
	
	checkEnabled:function(onSuccess) {
		onSuccess(true);
	},
		
	getEvents:function() {
		return [paella.events.loadComplete];
	},

	onEvent:function(eventType,params) {
		switch (eventType) {
			case paella.events.loadComplete:
				this.loadPublish();
				break;
		}
	},	
	
	loadPublish:function() {
		var thisClass = this;
		
		paella.data.read('publish',{id:paella.initDelegate.getId()},function(data,status) {
			if (status == true) {
				thisClass.checkPublish(data);
			}
			else {
				thisClass.noPublishInfo();
			}
		});
	},	
	
	checkPublish:function(data) {
		if (paella.initDelegate.initParams.accessControl.permissions.canWrite) {
			if (data == false){
				this.showOverlayMessage("This video is not published. Edit the video to publish it.");
			}
			else if ((data == "undefined") || (data === undefined)) {
				this.showOverlayMessage("This video is not published. It will be published automatically in a few days. Edit the video to change this behaviour.");
			}
		}
		else {
			if ((data == false) || (data == "undefined") || (data == undefined)){
				if (paella.initDelegate.initParams.accessControl.permissions.isAnonymous == true) {
					paella.player.unloadAll(paella.dictionary.translate("This video is not published. If you are the author, Log In to publish it."));
					// window.href = "auth.html?redirect="+encodeURIComponent(window.href);
				}
				else {					
					paella.player.unloadAll(paella.dictionary.translate("This video is not published."));
				}						
			}
		}
	},	
		
	showOverlayMessage:function(message) {
		var overlayContainer = paella.player.videoContainer.overlayContainer;
		var rect = {left:40, top:50, width:1200, height:80};
		
		var root = document.createElement("div");
		root.className = 'publishVideoOverlay';
		var element = document.createElement("div");
		element.className = 'publishVideoNotPublished';
		element.innerHTML = paella.dictionary.translate(message);
		
		root.appendChild(element);
		
		overlayContainer.addElement(root, rect);	
	},
	
	noPublishInfo:function() {
		var defaultValue = true;
		if (this.config.defaultValue != undefined) {
			defaultValue = this.config.defaultValue;
		}
		this.checkPublish(defaultValue);
	}
});

paella.plugins.publishPlugin = new paella.plugins.PublishPlugin();





////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// Editor Publish Plugin
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
paella.plugins.PublishEditorPlugin = Class.create(paella.editor.EditorToolbarPlugin,{
	status:'-',

	initialize:function() {
		this.parent();
		if (paella.utils.language()=='es') {
			paella.dictionary.addDictionary({
				'Publish':'Publicar',
				'Do not publish':'No publicar',
				'Publish automatically':'Publicar automáticamente'
			});
		}
	},

	getName:function() { return "es.upv.paella.matterhorn.publishEditorPlugin"; },

	checkEnabled:function(onSuccess) {
		var thisClass = this;
		
		paella.data.read('publish',{id:paella.initDelegate.getId()},function(data,status) {
			if (status == true) {
				if (data == true){
					thisClass.status = "Publish";
				}
				else if (data==false){
					thisClass.status = "Do not publish";
				}
				else if (data=="undefined"){
					thisClass.status = "Publish automatically";
				}			
			}
			//else {
			//	thisClass.status = "No Publish info";
			//}
		});
				
		onSuccess(true);
	},
	
	
	getButtonName:function() {
		return paella.dictionary.translate(this.status);
	},
	
	getIcon:function() {
		return "icon-share";
	},

	getOptions:function() {
		return [paella.dictionary.translate("Publish"),
				paella.dictionary.translate("Publish automatically"),
				paella.dictionary.translate("Do not publish")];
	},
	
	onOptionSelected:function(optionIndex) {
		switch (optionIndex) {
			case 0:
				this.status = "Publish";
				break;
			case 1:
				this.status = "Publish automatically";
				break;
			case 2:
				this.status = "Do not publish";
				break;
		}
	},
	
	onSave:function(onSuccess) {	
		var value="undefined";
		
		if (this.status != "-") {
			if (this.status == "Publish"){
				value = "true";
			}
			else if (this.status == "Publish automatically"){
				value = "undefined";
			}
			else if (this.status == "Do not publish"){
				value = "false";
			}
		}	

		paella.data.write('publish', {id:paella.initDelegate.getId()}, value, function(response,status) {
			onSuccess(status);
		});
	}
});

paella.plugins.publishEditorPlugin = new paella.plugins.PublishEditorPlugin();

/*** File: paella-matterhorn/plugins/es.upv.paella.matterhorn.searchPlugin/mh_search.js ***/
paella.plugins.SearchPlugin  = Class.create(paella.TabBarPlugin,{
	divContainer:null,
	divSearchBar:null,
	divLoading:null,
	divResults:null,
	divSearch:null,
	divSearchBarRelevance:null,
	
	resultsEntryID:'',
	foundAlready:false, // flag if something has already been found
	lastHit:'',         // storage for latest successful search hit
	proxyUrl:'',
	useJsonp:false,
	
	
	getSubclass:function() { return "searchTabBar"; },
	getName:function() { return 'es.upv.paella.matterhorn.searchPlugin'; },
	getTabName:function() { return paella.dictionary.translate('Search'); },
	getIndex:function() { return 20; },
	getDefaultToolTip:function() { return paella.dictionary.translate("Search"); },		
	
	checkEnabled:function(onSuccess) {
		var ret = false;
		if (paella.matterhorn && paella.matterhorn.episode && paella.matterhorn.episode.segments) {
			ret = true;
		}
		onSuccess(ret);
	},
		
	setup:function() {},
	
	buildContent:function(domElement) {
		this.domElement = domElement;
		this.loadContent();
	},
	
	action:function(tab) {},
					
	loadContent:function() {
		this.divContainer = document.createElement('div');
		this.divContainer.className = 'searchTabBarContainer';

		this.divSearchBar = document.createElement('div');
		this.divSearchBar.className = 'searchTabBarSearchBar';

		this.divLoading = document.createElement('div');
		this.divLoading.className = 'searchTabBarLoading';

		this.divResults = document.createElement('div');
		this.divResults.className = 'searchTabBarResults';

		this.divSearch = document.createElement('div');
		this.divSearch.className = 'searchTabBarSearch';

		
		this.divContainer.appendChild(this.divSearchBar);
		this.divContainer.appendChild(this.divLoading);
		this.divContainer.appendChild(this.divSearch);
		this.divContainer.appendChild(this.divResults);
		this.domElement.appendChild(this.divContainer);
		
		this.prepareSearchBar();
		this.loadSegmentText();
	},


	setLoading:function(b) {
		if (b == true){
			this.divLoading.style.display="block";
			this.divResults.style.display="none";
		}
		else{
			this.divLoading.style.display="none";
			this.divResults.style.display="block";
		}
	},


	prepareSearchBar:function(){
		var thisClass = this;
		
		var divSearchBarLeft = document.createElement('div');
		divSearchBarLeft.className = 'searchBar';

		this.divSearchBarRelevance = document.createElement('div');
		this.divSearchBarRelevance.className = 'relevanceInfo';
		
		
		// -------  Left
		var inputElement = document.createElement('input');
		inputElement.type = "text";
		inputElement.value = paella.dictionary.translate("Search in this recording");
		inputElement.setAttribute('size', '30');
		inputElement.setAttribute('dir','lrt');
		inputElement.setAttribute('spellcheck','true');
		inputElement.setAttribute('x-webkit-speech','');
		inputElement.setAttribute('tabindex','4000');
		inputElement.onfocus = function(){this.value=""; this.onfocus=undefined;};
		inputElement.onkeyup = function(){thisClass.doSearch(this.value);};	
		
		divSearchBarLeft.appendChild(inputElement);
		
		// -------  Right
		var r1 = document.createElement('div');
		var r2 = document.createElement('div');
		var r3 = document.createElement('div');
		var r4 = document.createElement('div');
		r1.className = 'text';
		r2.className = 'lt30';
		r3.className = 'lt70';
		r4.className = 'gt70';

		r1.innerHTML = paella.dictionary.translate("Search Relevance:");
		r2.innerHTML = "&lt; 30%";
		r3.innerHTML = "&lt; 70%";
		r4.innerHTML = "&gt; 70%";

		this.divSearchBarRelevance.appendChild(r1);
		this.divSearchBarRelevance.appendChild(r2);
		this.divSearchBarRelevance.appendChild(r3);
		this.divSearchBarRelevance.appendChild(r4);

		this.divSearchBar.appendChild(divSearchBarLeft);
		this.divSearchBar.appendChild(this.divSearchBarRelevance);
	},
		
	loadSegmentText:function() {
		this.setLoading(true);
		this.divResults.innerHTML = "";
				
				
		if (paella.matterhorn.episode.segments === undefined) {
			paella.debug.log("Segment Text data not available");
		} 
		else {
			var segments = paella.matterhorn.episode.segments;
			for (var i =0; i < segments.segment.length; ++i ){
				var segment = segments.segment[i];
				this.appendSegmentTextEntry(segment);
			}
		}				
		this.setLoading(false);
	},		
		
	appendSegmentTextEntry:function(segment) {
		var thisClass = this;
		var rootID = thisClass.resultsEntryID+segment.index;
		
				
		var divEntry = document.createElement('div');
		divEntry.className="searchTabBarResultEntry";
		divEntry.id="searchTabBarResultEntry_" + segment.index;
		divEntry.setAttribute('tabindex', 4100 + parseInt(segment.index));
		$(divEntry).click(function(event){ 
			$(document).trigger( paella.events.seekToTime, {time: segment.time/1000});
		});
		$(divEntry).keyup(function(event) {
			if (event.keyCode == 13) { $(document).trigger( paella.events.seekToTime, {time: segment.time/1000}); }
		});		

		var divPreview = document.createElement('div'); 
		divPreview.className = "searchTabBarResultEntryPreview";
		var imgPreview = document.createElement('img');
		imgPreview.src = segment.previews.preview.$;
		divPreview.appendChild(imgPreview);
		divEntry.appendChild(divPreview);
		

		var divResultText  = document.createElement('div'); 
		divResultText.className = "searchTabBarResultEntryText";
		
		
		var textResultText = document.createElement('a');
		textResultText.innerHTML = "<span class='time'>" + paella.utils.timeParse.secondsToTime(segment.time/1000) + "</span> " + segment.text;
		divResultText.appendChild(textResultText);
		divEntry.appendChild(divResultText);

		this.divResults.appendChild(divEntry);
	},






	doSearch:function(value) {
		var thisClass = this;
		if (value != '') {
			this.divSearchBarRelevance.style.display="block";
		}
		else {
			this.divSearchBarRelevance.style.display="none";			
		}
		this.setLoading(true);
		
		
		var segmentsAvailable = false;
		paella.ajax.get({url:'/search/episode.json', params:{id:paella.matterhorn.episode.id, q:value, limit:1000}},
			function(data, contentType, returnCode) {
				paella.debug.log("Searching episode="+paella.matterhorn.episode.id + " q="+value);

                segmentsAvailable = (data !== undefined) && (data['search-results'] !== undefined) &&
                    (data['search-results'].result !== undefined) && 
                    (data['search-results'].result.segments !== undefined) && 
                    (data['search-results'].result.segments.segment.length > 0);
				
                if (value === '') {
                  thisClass.setNotSearch();
                } 
                else { 
                  thisClass.setResultAvailable(value);
                }				
				
				if (segmentsAvailable) {
					var segments = data['search-results'].result.segments;					
					var maxRelevance = 0;
					var i, segment;

					for (i =0; i < segments.segment.length; ++i ){
						segment = segments.segment[i];
						if (maxRelevance < parseInt(segment.relevance)) {
							maxRelevance = parseInt(segment.relevance);
						}
					}
					paella.debug.log("Search Max Revelance " + maxRelevance);


					for (i =0; i < segments.segment.length; ++i ){
						segment = segments.segment[i];
						var relevance = parseInt(segment.relevance);
						
						var relevanceClass = '';
						if (value !== '') {
							if (relevance <= 0) {
								relevanceClass = 'none_relevance';
							} else if (relevance <  Math.round(maxRelevance * 30 / 100)) {
								relevanceClass = 'low_relevance';
							} else if (relevance < Math.round(maxRelevance * 70 / 100)) {
								relevanceClass = 'medium_relevance';
							} else {
								relevanceClass = 'high_relevance';
							}
						}
						
						var divEntry = $('#searchTabBarResultEntry_'+segment.index);
						divEntry[0].className = 'searchTabBarResultEntry ' + relevanceClass;
					}

					if (!thisClass.foundAlready) {
						thisClass.foundAlready = true;
					}
					thisClass.lastHit = value;
				}
				else {
					paella.debug.log("No Revelance");
					if (!thisClass.foundAlready){
						//setNoSegmentDataAvailable();
					}
					else {
						thisClass.setNoActualResultAvailable(value);
					}
				}
				thisClass.setLoading(false);				
			},
			function(data, contentType, returnCode) {
				thisClass.setLoading(false);
			}
		);
	},
	
	
    setNoActualResultAvailable:function(searchValue) {
     	this.divSearch.innerHTML = paella.dictionary.translate("Results for '{0}; (no actual results for '{1}' found)").replace(/\{0\}/g,this.lastHit).replace(/\{1\}/g,searchValue);
     	
    },

    setResultAvailable:function(searchValue) {
     	this.divSearch.innerHTML =  paella.dictionary.translate("Results for '{0}'").replace(/\{0\}/g,searchValue);
    },
    
    setNotSearch:function() {
     	this.divSearch.innerHTML="";
    }	
});


paella.plugins.searchPlugin = new paella.plugins.SearchPlugin();

/*** File: paella-matterhorn/plugins/es.upv.paella.matterhorn.userTrackingSaverPlugIn/mh_usertracking_saver.js ***/
new (Class (paella.userTracking.SaverPlugIn, {
	getName: function() { return "es.upv.paella.matterhorn.userTrackingSaverPlugIn"; },
	
	checkEnabled: function(onSuccess) {
		paella.ajax.get({url:'/usertracking/detailenabled'},
			function(data, contentType, returnCode) {
				if (data == 'true') {
					onSuccess(true); 					
				}
				else {
					onSuccess(false); 
				}
			},
			function(data, contentType, returnCode) {
				onSuccess(false);
			}
		);	
	},
	
	log: function(event, params) {
		var videoCurrentTime = parseInt(paella.player.videoContainer.currentTime() + paella.player.videoContainer.trimStart());		
		var matterhornLog = {
			_method: 'PUT',
			'id': paella.player.videoIdentifier,
			'type': undefined,
			'in': videoCurrentTime,
			'out': videoCurrentTime,
			'playing': !paella.player.videoContainer.paused()
		};
		
		switch (event) {
			case paella.events.play:
				matterhornLog.type = 'PLAY';
				break;
			case paella.events.pause:
				matterhornLog.type = 'PAUSE';
				break;
			case paella.events.seekTo:
			case paella.events.seekToTime:
				matterhornLog.type = 'SEEK';
				break;
			case paella.events.resize:
				matterhornLog.type = "RESIZE-TO-" + params.width + "x" + params.height;
				break;
			case "paella:searchService:search":
				matterhornLog.type = "SEARCH-" + params;
				break;
			default:
				matterhornLog.type = event;
				opt = params;
				if (opt != undefined) {				
					if (typeof(params) == "object") {
						opt = JSON.stringify(params);
					}
					matterhornLog.type = event + ';' + opt;
				}
				break;
		}	
		//console.log(matterhornLog);
		paella.ajax.get( {url: '/usertracking/', params: matterhornLog });			
	}
}))();
