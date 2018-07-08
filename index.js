/* npm modules init */
var app = require('express')();
var srv = require('http').Server(app);
var io = require('socket.io')(srv);
var pg = require('pg');
var path = require('path');
var _=require("lodash");


/* local modules init */
const headers = require('./headers')(app,path);
const local=require('./local_handler.js');
const _utils=require('./utils.js');
const db=require('./db.js');
const _save=require('./save_to_file.js');

_save.save_as_pdf({filename:'my_pdf.pdf',src:'./workfolder/my.html'});
_save.save_as_docx({filename:'my_docx.docx',src:'./workfolder/my.html'});

/*connection*/
db.connectAllClients();

io.on('connection', function (socket) {
  	
	console.log("conn estb");
	socket.emit('msg', { data: "We are connected!" });
  	

	socket.on('search', function(data) {
		console.log(data);
		_.forEach(data.posts,function(v,k){
			var ips="";
			for(var i=0; i<v.length;i++){
				if (ips != "") ips += ",";
				ips+=v[i];
			}
			if(data.car_number!=""){
				local._search(local._prepare_search_query_specified_car(data,ips,{limit:25,offset:0}),k,socket,db,data.report_type,true);
			}else{
				local._search(local._prepare_search_query(data,ips,{limit:25,offset:0}),k,socket,db,data.report_type,false);


        		/*local._search(`SELECT json_build_array(array_agg((i.car_number, i.date, i.time,i.direction))), i.name, i.ip FROM
				  (SELECT p.name, e.ip, to_char(e.the_date,'DD-MM-YYYY') as date, to_char(e.the_date, 'HH24:MI:SS') as time, e.direction, e.car_number
				          FROM events e JOIN posts p ON e.ip = p.ip WHERE the_date
				                BETWEEN to_timestamp('01-01-2017 00:00:00','DD-MM-YYYY HH24:MI:SS') AND to_timestamp('10-10-2018 23:00:00','DD-MM-YYYY HH24:MI:SS')
				                        AND e.ip=ANY('{192.168.2.14, 192.168.2.17,101.40.1.67}'::inet[])
				                              GROUP BY e.ip, e.direction, e.car_number, e.the_date, p.name ORDER BY e.the_date LIMIT 100) i
				        GROUP BY i.ip, i.name;`,k,socket,db);*/
			}
		});
	
	});

	socket.on('regions_data_live', function(d) { 		
 		_tosh_vil("SELECT array_agg(count) FROM (SELECT count(*), direction FROM events WHERE date(the_date) BETWEEN to_date('"+d.date+"','DD-MM-YYYY') AND to_date('"+_utils.getTodaysDateDDMMYY()+"','DD-MM-YYYY') GROUP BY direction ORDER BY direction) t;", socket);
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

	socket.on('close_db', function(data) {
		db.closeDB();
	});

});

const _tosh_vil=async function($q,socket){

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


srv.listen(3333);
console.log("Server started on port 3333 ...");

