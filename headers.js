const express=require('express');

module.exports=(app,path)=>{
	app.use(function (req, res, next) {
	    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3333');
	    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
	    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
	    res.setHeader('Access-Control-Allow-Credentials', true);
	    next();
	});

	app.use(express.static('workfolder'));
	app.get('/*', function(req, res){
	   res.sendFile(path.join(__dirname + '/403.html'));
	});

	app.get('/workfolder', function(req, res){
	   res.sendFile(path.join(__dirname + '/workfolder/my_pdf.html'));
	});
}