var fs = require('fs');
var pdf = require('html-pdf');
var HtmlDocx = require('html-docx-js');

var pdf_options = { 
	format: 'A4', 
	"base": "./workfolder",
	"border": {
	    "top": "1.2cm",            // default is 0, units: mm, cm, in, px
	    "right": "1.2cm",
	    "bottom": "1.2cm",
	    "left": "2cm"
	  }
};

var save_to_file=module.exports={
	save_as_pdf:function(options){
		pdf.create(fs.readFileSync(options.src, 'utf8'), pdf_options).toFile(options.filename, function(err, res) {
		  if (err) return console.log(err);
		  console.log('Pdf file is ready'); 
		});
	},
	save_as_docx:function(options){
		var docx = HtmlDocx.asBlob(options.src);
	    fs.writeFile(options.filename,docx, function (err){
	       if (err) return console.log(err);
	       console.log('Docx file is ready');
	    });
	}
}