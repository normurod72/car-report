const _=require("lodash");
const db=require('./db.js');
const _save=require('./save_to_file.js');
const path = require('path');
const ping = require('ping');
var Log = require('log')
, fs = require('fs')
, stream = fs.createWriteStream(__dirname + '/file.log', { flags: 'a' })
, log = new Log('debug', stream);

const html_head=`
  <!DOCTYPE html>
  <html>
    <head>
      <meta http-equiv="content-type" content="text/html; charset=UTF-8">
      <title>Otchet</title>
      <link rel="stylesheet" type="text/css" href="http://localhost:3333/bootstrap.min.css">
      <link rel="stylesheet" type="text/css" href="http://localhost:3333/my.css">
      <script type="text/javascript" src="http://localhost:3333/jquery.min.js"></script>
      <script type="text/javascript" src="http://localhost:3333/bootstrap.min.js"></script>
    </head>
  <body>
`;
const temp_file="./workfolder/my.html";

var local=module.exports={
    _get_posts:async function($kod_regions,socket,server){
      $str="";
      for(var i=0;i<$kod_regions.length;i++){
        if($str!=""){$str+=","+$kod_regions[i];}else{$str+=$kod_regions[i];}
      }
      var res = await server.query('SELECT row_to_json(t) as json_data from (SELECT array_agg(posts.name) as posts,  array_agg(posts.ip) as ips, regions.kod as reg_kod, regions.name as reg_name FROM posts JOIN regions ON regions.id=posts.rid WHERE state=TRUE AND regions.kod=ANY(\'{'+$str+'}\'::varchar[]) group by regions.kod,regions.name) t;');
      socket.emit('s_posts', res.rows );
    },

    _unlink_files_from_folder:function(directory){
      fs.readdir(directory, (err, files) => {
        if (err) throw err;

        for (const file of files) {
          fs.unlink(path.join(directory, file), err => {
            if (err) throw err;
          });
        }
      });
    },

    _search:async function($q,$kod,socket,db,$type,$car,$download=false,extra,report_title){
      var res = await db.clients["kod_"+$kod].query($q);
      if($download){
        qnumber++;
        console.log(`Query number ${qnumber} has been finished!`);
        if(qnumber>1){
          this._write_to_html(res.rows,temp_file,extra[$kod],report_title);
        }else{
          this._unlink_files_from_folder('temp');
          fs.unlink(temp_file, function (err) {
            if (err) throw err;
            console.log('File deleted!');
          });
          this._write_to_html(res.rows,temp_file,extra[$kod],report_title,'w');
        }
        console.log(Object.keys(extra).length);
        if(Object.keys(extra).length==qnumber){
          fs.appendFile(temp_file, "</body></html>", function(err) {
              if(err) {
                  return console.log(err);
              }
              console.log("Last things!");

              _save.save_as_pdf({filename:`${report_title.from.replaceAll(' ','_').replaceAll(':','')}__${report_title.to.replaceAll(' ','_').replaceAll(':','')}`,src:temp_file},socket);
          });
          console.log("End of execution of queries");
          qnumber=0;
        }
      }else{
        socket.emit('search_data_'+$kod, { "data": res.rows, "kod":$kod, "type":$type, "car":$car }); 
      }
    },

    _write_to_html:function(data,path,title,report_title,mode='a'){
      console.log(data);
     
        if(mode=='a'){
          fs.appendFile(path, this._prepare_html_data(data,title,report_title), function(err) {
              if(err) {
                  return console.log(err);
              }
              console.log("Data appended!");
          });
        }else{
          fs.writeFile(path, this._prepare_html_data(data,title,report_title), function(err) {
              if(err) {
                  return console.log(err);
              }
              console.log("Writing started!");
          });
        }
    },

    _update_region_sts:async function(id,sts){
      var res = await db.server.query(`UPDATE regions SET status=${sts} WHERE id=${id};`);
    },

    _send_regions_sts:async function(socket){
      var res = await db.server.query(`SELECT kod, status FROM regions;`);
      socket.emit("sidebar_live",{"data":res.rows});
    },

    _check_connections:function(hosts,mode='n',socket){
      _.forEach(hosts,function(v,k){
        ping.sys.probe(v.ip, function(isAlive){
          if(isAlive && !v.status){
            local._update_region_sts(v.id,true);
          }else{
            if(!v.status){
              local._update_region_sts(v.id,false);
            }
          }
        },{ timeout: 3 });
      });
      
      local._send_regions_sts(socket);
    
      if(mode=='r'){
        setTimeout(function(){
          local._check_connections(hosts,'r',socket);
        },30000);
      }
      return;
    },

    _prepare_html_data: function(data,title,report_title){
      
      var ttitle=`<h3 class="text-center text-primary">${title}</h3>`;
      var Rtitle=`<h2 id="table-title" class="text-center text-primary">Отчет от ${report_title.from} до ${report_title.to}</h2>`;
      var nodatinfo="<h4 class='text-center text-info'>В выбранном периоде в этой области нет данных</h4>";
      var thead=`<table class="table table-bordered" id="results_table"><thead><tr><th>Номер</th><th>Дата</th><th>Время</th><th>Направление</th></tr></thead>`;
      var tbody="";
      _.forEach(data,function(val,key){
        tbody=`<tbody data-ip="${val.ip}"><tr><td colspan="4" class="text-left"><b>${val.name} ЙПХ маскани</b></td></tr>`;
        _.forEach(val.json_build_array[0],function(v,k){
          tbody+=`
          <tr><td>${v.f1}</td><td>${v.f2}</td><td>${v.f3}</td><td>${(v.f4?'Кирган':'Чиккан')}</td></tr>`;
        });
        tbody+="</tbody>";
        thead+=tbody;
      });
      if(data.length!=0){
        if(qnumber==1){
          console.log("here nis that");
          return html_head+Rtitle+ttitle+thead+"</table>";
        }else{
          return ttitle+thead+"</table>";
        }
      }else{
        if(qnumber==1){
          return html_head+Rtitle+ttitle+nodatinfo;
        }else{
          return ttitle+nodatinfo;
        }
      }
    },

    _get_car_counts:async function($q,socket,$kod){
      var res = await db.clients["kod_"+$kod].query($q);
      log.debug($q);
      socket.emit('tosh_vil', { "data": res.rows, "kod":$kod });
    },

    _prepare_search_query:function(options,ips,pagination){
      switch (options.report_type){
        case 'car_by_date':
          return `
            SELECT json_build_array(array_agg((i.car_number, i.date, i.time,i.direction))), i.hostname as name, i.ip FROM
                (SELECT p.hostname, e.ip, to_char(e.the_date,'DD-MM-YYYY') as date, to_char(e.the_date, 'HH24:MI:SS') as time, e.direction, e.car_number
                      FROM events e JOIN clients p ON e.ip = p.ip WHERE the_date
                        BETWEEN to_timestamp('${options.from}','DD-MM-YYYY HH24:MI:SS') 
                        AND to_timestamp('${options.to}','DD-MM-YYYY HH24:MI:SS')
                        AND e.ip=ANY('{${ips}}'::inet[])
                        GROUP BY e.ip, e.direction, e.car_number, e.the_date, p.hostname ORDER BY e.the_date LIMIT ${pagination.limit} OFFSET ${pagination.offset}) i
                GROUP BY i.ip, i.hostname;`;
          break;
        case 'car_by_count':
          return `
            SELECT json_build_array(array_agg((j.array_agg,j.car_number))), j.hostname, j.ip
              FROM (SELECT array_agg(count), i.car_number, i.hostname as name, i.ip
                    FROM (SELECT p.hostname, e.ip, count(*), e.direction, e.car_number
                          FROM events e JOIN clients p ON e.ip = p.ip WHERE the_date
                          BETWEEN to_timestamp('${options.from}','DD-MM-YYYY HH24:MI:SS')
                          AND to_timestamp('${options.to}','DD-MM-YYYY HH24:MI:SS')
                          AND e.ip=ANY('{${ips}}'::inet[])
                          GROUP BY e.ip, e.direction, e.car_number, p.hostname
                          ORDER BY e.car_number
                          LIMIT 150) i
                    GROUP BY i.car_number, i.hostname, i.ip LIMIT ${pagination.limit} OFFSET ${pagination.offset}) j
            GROUP BY j.hostname, j.ip
          `;
          break;
        case 'post_by_count':
          return `
            SELECT array_agg(count), b.hostname as name, b.ip
              FROM (SELECT ip, count(*), direction
                    FROM events WHERE date(the_date)
                        BETWEEN to_timestamp('${options.from}','DD-MM-YYYY HH24:MI:SS')
                        AND to_timestamp('${options.to}','DD-MM-YYYY HH24:MI:SS')
                        AND ip=ANY('{${ips}}'::inet[])
                        GROUP BY ip, direction
                        ORDER BY ip, direction LIMIT ${pagination.limit} OFFSET ${pagination.offset}) t
              JOIN clients b ON t.ip = b.ip
            GROUP BY b.hostname, b.ip;
          `;
          break;
        case 'regions_by_count':
          return `
            SELECT array_agg(count)
            FROM (SELECT count(*), direction
                    FROM events WHERE date(the_date)
                    BETWEEN to_timestamp('${options.from}','DD-MM-YYYY HH24:MI:SS')
                    AND to_timestamp('${options.to}','DD-MM-YYYY HH24:MI:SS')
                AND ip=ANY('{${ips}}'::inet[])
                GROUP BY direction LIMIT ${pagination.limit} OFFSET ${pagination.offset}) t;`;
          break;
        default:
          return `
            SELECT json_build_array(array_agg((i.car_number, i.date, i.time,i.direction))), i.hostname as name, i.ip FROM
                (SELECT p.hostname, e.ip, to_char(e.the_date,'DD-MM-YYYY') as date, to_char(e.the_date, 'HH24:MI:SS') as time, e.direction, e.car_number
                      FROM events e JOIN clients p ON e.ip = p.ip WHERE the_date
                        BETWEEN to_timestamp('${options.from}','DD-MM-YYYY HH24:MI:SS') 
                        AND to_timestamp('${options.to}','DD-MM-YYYY HH24:MI:SS')
                        AND e.ip=ANY('{${ips}}'::inet[])
                        GROUP BY e.ip, e.direction, e.car_number, e.the_date, p.hostname ORDER BY e.the_date LIMIT ${pagination.limit} OFFSET ${pagination.offset}) i
                GROUP BY i.ip, i.hostname;`;
     }
   },

   _prepare_search_query_specified_car:function(options,ips, pagination){
      switch (options.report_type){
        case 'car_by_date':
          return `
            SELECT json_build_array(array_agg((i.car_number, i.date, i.time,i.direction))), i.hostname as name, i.ip FROM
              (SELECT p.hostname, e.ip, to_char(e.the_date,'DD-MM-YYYY') as date, to_char(e.the_date, 'HH24:MI:SS') as time, e.direction, e.car_number
                      FROM events e JOIN clients p ON e.ip = p.ip WHERE the_date
                            BETWEEN to_timestamp('${options.from}','DD-MM-YYYY HH24:MI:SS') 
                            AND to_timestamp('${options.from}','DD-MM-YYYY HH24:MI:SS')
                            AND e.ip=ANY('{${ips}}'::inet[]) 
                            AND car_number=ANY('{${options.car_number}}')
                            GROUP BY e.ip, e.direction, e.car_number, e.the_date, p.hostname 
                            ORDER BY e.the_date LIMIT ${pagination.limit} OFFSET ${pagination.offset}) i
                    GROUP BY i.ip, i.hostname;`;
          break;
        case 'car_by_count':
          return `
            SELECT json_build_array(array_agg((j.array_agg,j.car_number))), j.hostname as name, j.ip 
            FROM (SELECT array_agg(count), b.hostname, t.ip, t.car_number
                FROM (SELECT ip, count(*), direction, car_number
                        FROM events WHERE date(the_date)
                            BETWEEN to_timestamp('${options.from}','DD-MM-YYYY HH24:MI:SS')
                              AND to_timestamp('${options.from}','DD-MM-YYYY HH24:MI:SS')
                              AND ip=ANY('{${ips}}'::inet[])
                              AND car_number=ANY('{${options.car_number}}')
                            GROUP BY ip, direction, car_number
                            ORDER BY ip, direction LIMIT ${pagination.limit} OFFSET ${pagination.offset}) t
                  JOIN clients b ON t.ip = b.ip
                GROUP BY b.hostname, t.ip, t.car_number) j
            GROUP BY j.hostname, j.ip;
          `;
          break;
        case 'post_by_count':
          return `
            SELECT json_build_array(array_agg((j.array_agg,j.hostname,j.ip))), j.car_number 
            FROM (SELECT array_agg(count), b.hostname as name, t.ip, t.car_number
                FROM (SELECT ip, count(*), direction, car_number
                        FROM events WHERE date(the_date)
                            BETWEEN to_timestamp('${options.from}','DD-MM-YYYY HH24:MI:SS')
                              AND to_timestamp('${options.from}','DD-MM-YYYY HH24:MI:SS')
                              AND ip=ANY('{${ips}}'::inet[])
                              AND car_number=ANY('{${options.car_number}}')
                            GROUP BY ip, direction, car_number
                            ORDER BY ip, direction LIMIT ${pagination.limit} OFFSET ${pagination.offset}) t
                  JOIN clients b ON t.ip = b.ip
                GROUP BY b.hostname, t.ip, t.car_number) j
            GROUP BY j.car_number;
          `;
          break;
        case 'regions_by_count':
          return `
            SELECT array_agg(count), t.car_number
            FROM (SELECT count(*), direction, car_number
                    FROM events WHERE date(the_date)
                    BETWEEN to_timestamp('${options.from}','DD-MM-YYYY HH24:MI:SS')
                    AND to_timestamp('${options.to}','DD-MM-YYYY HH24:MI:SS')
                    AND ip=ANY('{${ips}}'::inet[]) 
                    AND car_number=ANY('{${options.car_number}}')
                  GROUP BY direction,car_number LIMIT ${pagination.limit} OFFSET ${pagination.offset}) t GROUP BY t.car_number;`;
          break;
        default:
          return `
            SELECT json_build_array(array_agg((i.car_number, i.date, i.time,i.direction))), i.hostname as name, i.ip FROM
              (SELECT p.hostname, e.ip, to_char(e.the_date,'DD-MM-YYYY') as date, to_char(e.the_date, 'HH24:MI:SS') as time, e.direction, e.car_number
                      FROM events e JOIN clients p ON e.ip = p.ip WHERE the_date
                            BETWEEN to_timestamp('${options.from}','DD-MM-YYYY HH24:MI:SS') 
                            AND to_timestamp('${options.from}','DD-MM-YYYY HH24:MI:SS')
                            AND e.ip=ANY('{${ips}}'::inet[]) 
                            AND car_number=ANY('{${options.car_number}}')
                            GROUP BY e.ip, e.direction, e.car_number, e.the_date, p.hostname 
                            ORDER BY e.the_date LIMIT ${pagination.limit} OFFSET ${pagination.offset}) i
                    GROUP BY i.ip, i.hostname;`;
     }
   }

}