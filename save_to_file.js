var fs = require('fs');
var HtmlDocx = require('html-docx-js');
var wkhtmltopdf = require('wkhtmltopdf');

var save_to_file=module.exports={
	save_as_pdf:function(options,socket){
		wkhtmltopdf(fs.readFileSync(options.src, 'utf8'), { 
			output: './temp/'+options.filename+'.pdf',
			pageSize: 'A4',
			footerRight:'[page]/[topage]',
			footerFontSize:8,
			footerSpacing:1,
			footerLeft:'© 2018, fizmasoft' 
		}, 
		function (err, stream) {
		  if(err){
		  	socket.emit("pdf_res",{"status":0});
		  }else{
		  	socket.emit("pdf_res",{
		  		"status":1,
		  		"filename":options.filename
		  	});
		  }
		});
	},
	save_as_docx:function(options){
		var docx = HtmlDocx.asBlob(fs.readFileSync(options.src, 'utf8'));
	    fs.writeFile(options.filename,docx, function (err){
	       if (err) return console.log(err);
	       console.log('Docx file is ready');
	    });
	}
}