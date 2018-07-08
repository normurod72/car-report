var local=module.exports={
    _get_posts:async function($kod_regions,socket,server){
      $str="";
      for(var i=0;i<$kod_regions.length;i++){
        if($str!=""){$str+=","+$kod_regions[i];}else{$str+=$kod_regions[i];}
      }
      var res = await server.query('SELECT row_to_json(t) as json_data from (SELECT array_agg(posts.name) as posts,  array_agg(posts.ip) as ips, regions.kod as reg_kod, regions.name as reg_name FROM posts JOIN regions ON regions.id=posts.rid WHERE state=TRUE AND regions.kod=ANY(\'{'+$str+'}\'::varchar[]) group by regions.kod,regions.name) t;');
      socket.emit('s_posts', res.rows );
    },

    _search:async function($q,$kod,socket,db,$type,$car){
      console.log($kod);
        var res = await db.clients["kod_"+$kod].query($q);
      //**
      //console.log(res.rows);
      socket.emit('search_data_'+$kod, { "data": res.rows, "kod":$kod, "type":$type, "car":$car }); 
    },

    _prepare_search_query:function(options,ips,pagination){
      switch (options.report_type){
        case 'car_by_date':
          return `
            SELECT json_build_array(array_agg((i.car_number, i.date, i.time,i.direction))), i.name, i.ip FROM
                (SELECT p.name, e.ip, to_char(e.the_date,'DD-MM-YYYY') as date, to_char(e.the_date, 'HH24:MI:SS') as time, e.direction, e.car_number
                      FROM events e JOIN posts p ON e.ip = p.ip WHERE the_date
                        BETWEEN to_timestamp('${options.from}','DD-MM-YYYY HH24:MI:SS') 
                        AND to_timestamp('${options.to}','DD-MM-YYYY HH24:MI:SS')
                        AND e.ip=ANY('{${ips}}'::inet[])
                        GROUP BY e.ip, e.direction, e.car_number, e.the_date, p.name ORDER BY e.the_date LIMIT ${pagination.limit} OFFSET ${pagination.offset}) i
                GROUP BY i.ip, i.name;`;
          break;
        case 'car_by_count':
          return `
            SELECT json_build_array(array_agg((j.array_agg,j.car_number))), j.name, j.ip
              FROM (SELECT array_agg(count), i.car_number, i.name, i.ip
                    FROM (SELECT p.name, e.ip, count(*), e.direction, e.car_number
                          FROM events e JOIN posts p ON e.ip = p.ip WHERE the_date
                          BETWEEN to_timestamp('${options.from}','DD-MM-YYYY HH24:MI:SS')
                          AND to_timestamp('${options.to}','DD-MM-YYYY HH24:MI:SS')
                          AND e.ip=ANY('{${ips}}'::inet[])
                          GROUP BY e.ip, e.direction, e.car_number, p.name
                          ORDER BY e.car_number
                          LIMIT 150) i
                    GROUP BY i.car_number, i.name, i.ip LIMIT ${pagination.limit} OFFSET ${pagination.offset}) j
            GROUP BY j.name, j.ip
          `;
          break;
        case 'post_by_count':
          return `
            SELECT array_agg(count), b.name, b.ip
              FROM (SELECT ip, count(*), direction
                    FROM events WHERE date(the_date)
                        BETWEEN to_timestamp('${options.from}','DD-MM-YYYY HH24:MI:SS')
                        AND to_timestamp('${options.to}','DD-MM-YYYY HH24:MI:SS')
                        AND ip=ANY('{${ips}}'::inet[])
                        GROUP BY ip, direction
                        ORDER BY ip, direction LIMIT ${pagination.limit} OFFSET ${pagination.offset}) t
              JOIN posts b ON t.ip = b.ip
            GROUP BY b.name, b.ip;
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
            SELECT json_build_array(array_agg((i.car_number, i.date, i.time,i.direction))), i.name, i.ip FROM
                (SELECT p.name, e.ip, to_char(e.the_date,'DD-MM-YYYY') as date, to_char(e.the_date, 'HH24:MI:SS') as time, e.direction, e.car_number
                      FROM events e JOIN posts p ON e.ip = p.ip WHERE the_date
                        BETWEEN to_timestamp('${options.from}','DD-MM-YYYY HH24:MI:SS') 
                        AND to_timestamp('${options.to}','DD-MM-YYYY HH24:MI:SS')
                        AND e.ip=ANY('{${ips}}'::inet[])
                        GROUP BY e.ip, e.direction, e.car_number, e.the_date, p.name ORDER BY e.the_date LIMIT ${pagination.limit} OFFSET ${pagination.offset}) i
                GROUP BY i.ip, i.name;`;
     }
   },

   _prepare_search_query_specified_car:function(query,options,ips, pagination){
      switch (options.report_type){
        case 'car_by_date':
          return `
            SELECT json_build_array(array_agg((i.car_number, i.date, i.time,i.direction))), i.name, i.ip FROM
              (SELECT p.name, e.ip, to_char(e.the_date,'DD-MM-YYYY') as date, to_char(e.the_date, 'HH24:MI:SS') as time, e.direction, e.car_number
                      FROM events e JOIN posts p ON e.ip = p.ip WHERE the_date
                            BETWEEN to_timestamp('${options.from}','DD-MM-YYYY HH24:MI:SS') 
                            AND to_timestamp('${options.from}','DD-MM-YYYY HH24:MI:SS')
                            AND e.ip=ANY('{${ips}}'::inet[]) 
                            AND car_number=ANY('{${options.car_number}}')
                            GROUP BY e.ip, e.direction, e.car_number, e.the_date, p.name 
                            ORDER BY e.the_date LIMIT ${pagination.limit} OFFSET ${pagination.offset}) i
                    GROUP BY i.ip, i.name;`;
          break;
        case 'car_by_count':
          return `
            SELECT json_build_array(array_agg((j.array_agg,j.car_number))), j.name, j.ip 
            FROM (SELECT array_agg(count), b.name, t.ip, t.car_number
                FROM (SELECT ip, count(*), direction, car_number
                        FROM events WHERE date(the_date)
                            BETWEEN to_timestamp('${options.from}','DD-MM-YYYY HH24:MI:SS')
                              AND to_timestamp('${options.from}','DD-MM-YYYY HH24:MI:SS')
                              AND ip=ANY('{${ips}}'::inet[])
                              AND car_number=ANY('{${options.car_number}}')
                            GROUP BY ip, direction, car_number
                            ORDER BY ip, direction LIMIT ${pagination.limit} OFFSET ${pagination.offset}) t
                  JOIN posts b ON t.ip = b.ip
                GROUP BY b.name, t.ip, t.car_number) j
            GROUP BY j.name, j.ip;
          `;
          break;
        case 'post_by_count':
          return `
            SELECT json_build_array(array_agg((j.array_agg,j.name,j.ip))), j.car_number 
            FROM (SELECT array_agg(count), b.name, t.ip, t.car_number
                FROM (SELECT ip, count(*), direction, car_number
                        FROM events WHERE date(the_date)
                            BETWEEN to_timestamp('${options.from}','DD-MM-YYYY HH24:MI:SS')
                              AND to_timestamp('${options.from}','DD-MM-YYYY HH24:MI:SS')
                              AND ip=ANY('{${ips}}'::inet[])
                              AND car_number=ANY('{${options.car_number}}')
                            GROUP BY ip, direction, car_number
                            ORDER BY ip, direction LIMIT ${pagination.limit} OFFSET ${pagination.offset}) t
                  JOIN posts b ON t.ip = b.ip
                GROUP BY b.name, t.ip, t.car_number) j
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
            SELECT json_build_array(array_agg((i.car_number, i.date, i.time,i.direction))), i.name, i.ip FROM
              (SELECT p.name, e.ip, to_char(e.the_date,'DD-MM-YYYY') as date, to_char(e.the_date, 'HH24:MI:SS') as time, e.direction, e.car_number
                      FROM events e JOIN posts p ON e.ip = p.ip WHERE the_date
                            BETWEEN to_timestamp('${options.from}','DD-MM-YYYY HH24:MI:SS') 
                            AND to_timestamp('${options.from}','DD-MM-YYYY HH24:MI:SS')
                            AND e.ip=ANY('{${ips}}'::inet[]) 
                            AND car_number=ANY('{${options.car_number}}')
                            GROUP BY e.ip, e.direction, e.car_number, e.the_date, p.name 
                            ORDER BY e.the_date LIMIT ${pagination.limit} OFFSET ${pagination.offset}) i
                    GROUP BY i.ip, i.name;`;
     }
   }

}