/* npm modules init */
var app = require('express')();
var srv = require('http').Server(app);
var io = require('socket.io')(srv);
var pg = require('pg');
var path = require('path');
var _=require("lodash");
var Log = require('log')
, fs = require('fs')
, stream = fs.createWriteStream(__dirname + '/file.log', { flags: 'a' })
, log = new Log('debug', stream);


/********/
//var ping = require('ping');
 
/*var hosts = ['101.4.0.13', '101.4.0.3', '8.8.8.8'];
hosts.forEach(function(host){
    ping.sys.probe(host, function(isAlive){
    	
        var msg = isAlive ? 'host ' + host + ' is alive' : 'host ' + host + ' is dead';
        console.log(msg);
    },{ timeout: 3 });
});
*/


/********/


/* local modules init */
const headers = require('./headers')(app,path);
const local=require('./local_handler.js');
const _utils=require('./utils.js');
const db=require('./db.js');
const _save=require('./save_to_file.js');
global.qnumber=0; 




/*connection*/
db.connectAllClients(log);

io.on('connection', function (socket) {
  	
	console.log("conn estb");
	socket.emit('msg', { data: "We are connected!" });

	socket.on('check_conn', function(data) {
		local._check_connections(data.ip,socket);
	});

	socket.on('live',(data)=>{
		local._send_regions_sts(socket);
	});

	socket.on('get_posts_sts',(data)=>{
		local._get_posts_sts(data.kod,socket);
	});

	socket.on('search', function(data) {
		console.log(data);
		_.forEach(data.posts,function(v,k){
			var ips="";
			for(var i=0; i<v.length;i++){
				if (ips != "") ips += ",";
				ips+=v[i];
			}
			
			if(data.car_number!=""){
				local._search(local._prepare_search_query_specified_car(data,ips,{limit:data.limit,offset:data.offset}),k,socket,db,data.report_type,true,data.download,data.extra);
				log.debug(local._prepare_search_query_specified_car(data,ips,{limit:data.limit,offset:data.offset}));
			}else{
				log.debug(local._prepare_search_query(data,ips,{limit:data.limit,offset:data.offset}));
				local._search(local._prepare_search_query(data,ips,{limit:data.limit,offset:data.offset}),k,socket,db,data.report_type,false,data.download,data.extra,{from:data.from,to:data.to});
			}
		});
	
	});

	socket.on('regions_data_live', function(d) { 	
		global.required_length=d.kod.length;	
		_.forEach(d.kod,function(v,k){
			console.log(v);
 			local._get_car_counts("SELECT array_agg(count) FROM (SELECT count(*), direction FROM events WHERE date(the_date) BETWEEN to_date('"+d.date+"','DD-MM-YYYY') AND to_date('"+_utils.getTodaysDateDDMMYY()+"','DD-MM-YYYY') GROUP BY direction ORDER BY direction) t;", socket,v);
		});
 	});

	socket.on('regions_data_live_far', function(d) {
 		_far_vil("SELECT array_agg(count) FROM (SELECT count(*), direction FROM events WHERE date(the_date) BETWEEN to_date('"+d.date+"','DD-MM-YYYY') AND to_date('"+_utils.getTodaysDateDDMMYY()+"','DD-MM-YYYY') GROUP BY direction ORDER BY direction) t;", socket);
 	}); 	

 	socket.on('posts_data_live_tosh_vil', function(dq) { 		
 		_tosh_vil_posts("SELECT array_agg(count), b.name FROM (SELECT ip, count(*), direction FROM events WHERE date(the_date) BETWEEN to_date('"+dq.date+"','DD-MM-YYYY') AND to_date('"+_utils.getTodaysDateDDMMYY()+"','DD-MM-YYYY') GROUP BY ip,direction ORDER BY ip, direction) t JOIN posts b ON t.ip = b.ip GROUP BY b.name;", socket);
 	});

	socket.on('get_posts', function(data_regions) {
		local._get_posts(data_regions,socket,db.server);
	});

});

const _tosh_vil=async function($q,socket){

	console.log("_far_vil function called!!!!!!!");
   	var res = await db.clients.kod_10.query($q);
	console.log(res.rows);
	socket.emit('tosh_vil', { "data": res.rows });
	
}

const _far_vil=async function($q,socket){
	console.log("_far_vil function called!!!!!!!");
   	var res = await db.clients.kod_40.query($q);
	console.log("fargona:  ",res.rows);
	socket.emit('far_vil', { "data": res.rows });
	
}

/*SERVER INIT*/
srv.listen(3333);
console.log("Server started on port 3333 ...");


/*EXTRA*/
String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
};