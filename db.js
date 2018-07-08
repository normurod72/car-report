var pg = require('pg');
var server_dbconf=require('./conf.js');

var _db=module.exports={
	clients:{},
	server : new pg.Client("postgres://"+server_dbconf.dbuser+":"+server_dbconf.dbpass+"@"+server_dbconf.dbhost+":5432/"+server_dbconf.dbname+"?connectTimeout=0"),
	connectAllClients: async function (){ 
			await this.server.connect();
		   	var res = await this.server.query("SELECT * FROM regions;");
			for(var i=0;i<res.rows.length;i++){
				if(res.rows[i].ip!=null){
					this.clients["kod_"+res.rows[i].kod]=(new pg.Client("postgres://postgres:postgres@"+res.rows[i].ip+":5432/"+res.rows[i].db+"?connectTimeout=0"));
				}
			}

			for(var j in this.clients){
				try{
					console.log(1);
					await this.clients[j].connect();
				}catch(error){
					console.log("error:",j);
				}
			}
	},
	disconnectClient:async function($db_kod){
	   	await this.clients["kod_"+$db_kod].end();
	},
	disconnectAllClient(){

	}
}
