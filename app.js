var express = require('express'),
	app = express(),
	routes = require('./routes'),
	//errorHandler = require('errorhandler'),
	
	pg = require('pg'),
	sf = require('node-salesforce'),

    strftime = require('strftime'),
    validator = require('validator'),
    cp = require('child_process');

var pgConnectionString = process.env.DATABASE_URL || 'postgres://postgres:misspiggy@localhost:5432/postgres';
app.set('port', process.env.PORT || 3001); // use heroku's dynamic port or 3001 if localhost


// no Oauth2 client information is required with SOAP API login

var lserv = process.env.LOGIN_SERVER || "https://login.salesforce.com";
var username = process.env.USERNAME || 'lcohen@fdataserv.poc';
// password + security token:
var password = process.env.PASSWORD || '8DemoISV!0vRbUsQmV8RwbR5WLjwP0LZPD';
// hardcoding the orgID for now, not yet multi-tenant
var orgID = '00Dj0000000I5ifEAC';

var userInfo;

var conn = new sf.Connection({loginUrl: lserv});


/*
//Use the following to establish setup connection rather than login if you've stored instanceURL
//and accessToken, or just grabbed it from console if testing locally
var conn = new sf.Connection({
  instanceUrl : 'https://na15.salesforce.com',
  accessToken : '00Di0000000g6YX!AQ8AQFFVTE3YF9pdHKGiA2nn8ehnrOZ89xZUJJZ2fVt7uZwQ73v_XdA04RelRA__ImsMohDrDzlrrXn.GpElb8yZcYtwmM_n'
});
*/

var intesting = pgConnectionString.search('localhost') != -1;
if (!intesting ) { // remove this after testing, preventing the login to salesforce for now when running locally

conn.login(username, password, function (err, uInfo) {
	if (err) { return console.error(err); }
	userInfo = uInfo;
	console.log(conn.accessToken);
	console.log(conn.instanceUrl);
	console.log("User id: " + userInfo.id);
	console.log("Org id: " + userInfo.organizationId);
});
}

// not done refactoring routes.... 
routes(app, pgConnectionString);




// Accounts listing just for testing purposes
app.get('/accounts', function(req,res) {

	//req.params.orgid
	
	conn.query('select id, name from account limit 10', function(err, result) {
		if (err) {console.error(err); res.send('Error'); res.end; }
		console.log("total: " + result.totalSize);
		console.log("fetched: " + result.records.length);
		for (var i = 0; i < result.records.length; i++ ) {
			console.log('Record ' + i + ': ' + JSON.stringify(result.records[i]));
		}
		res.render("accounts", { title: 'Accounts in Salesforce - just for testing connection', data: result.records } );
		
	});
});

if (!Date.prototype.toISOString) {
  (function() {

    function pad(number) {
      if (number < 10) {
        return '0' + number;
      }
      return number;
    }

    Date.prototype.toISOString = function() {
      return this.getUTCFullYear() +
        '-' + pad(this.getUTCMonth() + 1) +
        '-' + pad(this.getUTCDate()) +
        'T' + pad(this.getUTCHours()) +
        ':' + pad(this.getUTCMinutes()) +
        ':' + pad(this.getUTCSeconds()) +
        '.' + (this.getUTCMilliseconds() / 1000).toFixed(3).slice(2, 5) +
        'Z';
    };

  }());
}

app.get('/dt', function(req,res) {

	console.log(strftime('%F %H:%M:%S'));

	res.status(200);
	res.end();
			return;
});

app.get('/testsub', function(req, res) {

	res.render("testsub", { title: 'Enter subscription info'} );

});

app.post('/subscribe', function(req, res) {
	/*if(req.headers['x-forwarded-proto'] && req.headers['x-forwarded-proto'] === "http") {
    	console.log("Caught /register over http. Redirecting to: " + "https://" + req.headers.host + req.url);
    	res.redirect("https://" + req.headers.host + req.url);
    	return;
	}*/
	
	if (typeof req.body.sf_org_id == 'undefined' || typeof req.body.physician_ids == 'undefined')  {
		console.log('Handling /subscribe. Request body does not include required fields. Body: ' + JSON.stringify(req.body));
		res.status(400).body('Error in request');
		res.end();
		return;
	}
	console.log('body: '  + JSON.stringify(req.body));
	
	var dev = {
		sf_org_id: req.body.sf_org_id || '',
		physician_ids: req.body.physician_ids || []
	};
	if (dev.sf_org_id == '' || dev.physician_ids.length < 1)  {
		console.log('Handling /subscribe. Either org id or physicians ids is empty. Body: ' + JSON.stringify(req.body));
		res.status(400).body('Error in request');
		res.end();
		return;
	}

    pg.connect(pgConnectionString, function(err, client, done) {
		if (err) {
			
			console.log('Error connecting to postgres db: ' + JSON.stringify(err));	
			res.status(500).body('Internal error');
			return;
		}

		var timestamp = strftime('%F %H:%M:%S');
		
		var valsString = '';
		var first = 'true';
		for (ix in dev.physician_ids) {
			if (first != 'true') {
				valsString += ', ';
			}
			first = 'false';
			valsString += ('(\'' + validator.escape(dev.sf_org_id) + '\', \'' + validator.escape(dev.physician_ids[ix]) + '\', \'' + timestamp + '\' )');
		}
		console.log('valsString before insert: ' + valsString);
		
		// just attempt insert; if any records already exists ignore error
		client.query('INSERT INTO "PhysiciansRefresh" (org_id, physician_id, last_refreshed) ' +
			'VALUES ' + valsString, 
			function(err, result) {
				done(); // release client back to the pool
				if (err) {	
					if (err.code == "23505")
					{
						// record already exists. that's ok
						console.log("some records already existed");	
					} else {
					
					console.log('Error inserting physicians subscription: ' + JSON.stringify(err));	
					res.status(500).body('Internal error');
					return;
					}
				} else {
			
					console.log('Physician subscription inserted: ' + valsString);													
				} 
		});	

	});		

  res.status(200);
  res.write('Success.');
  res.end();
});

app.get('/findPhysicians', function(req, res) {
	/*if(req.headers['x-forwarded-proto'] && req.headers['x-forwarded-proto'] === "http") {
    	console.log("Caught /register over http. Redirecting to: " + "https://" + req.headers.host + req.url);
    	res.redirect("https://" + req.headers.host + req.url);
    	return;
	}*/
	var rawquery = req.param('query');
	if (typeof rawquery == 'undefined') {
		console.log('Handling /findPhysicians. Query string parameter not provided.');
		res.status(400).body('Error in request');
		res.end();
		return;
	}
	
	var searchString = validator.escape(rawquery);
	console.log('in findPhysicians, query string = ' + searchString);

	

    pg.connect(pgConnectionString, function(err, client, done) {
		if (err) {
			
			console.log('Error connecting to postgres db: ' + JSON.stringify(err));	
			res.status(500).body('Internal error');
			res.end();
			return;
		}
		/*
		SELECT first_name, last_name, specialization, physician_id
		FROM physicians
		where last_name like 'Joh%' or specialization like '%Pod%'
		order by last_name, first_name limit 100;
		*/
		var queryStr = 'SELECT first_name, last_name, specialization, physician_id FROM "physicians" where ';
		queryStr = queryStr + 'last_name like \'' + searchString + '%\' or specialization like \'%' + searchString + '%\' ';
		queryStr = queryStr +  'order by last_name, first_name limit 100';
		//console.log('queryStr = ' + queryStr);
		client.query(queryStr, function(err, result) {
			done(); // release client back to the pool
			if (err) {
				console.log('Unable to retrieve physician records from postgres db. - ' + JSON.stringify(err));
				res.status(500).body('error retrieving data');
				res.end();
				return;
			}
			console.log("total physicians returned: " + result.rows.length);
			//console.log("result: " + JSON.stringify(result));
			//res.render("physicians/physicians", { title: 'Physicians', data: result } );
			// build JSON body to return 
			var searchResults = {physicians : []};
			for (i = 0; i < result.rows.length; i++) {
				var row = result.rows[i];
				//console.log('row: ' + JSON.stringify(row));
				var physician = {
					last_name : row.last_name,
					first_name : row.first_name,
					specialization : row.specialization,
					physician_id : row.physician_id
				};
				//console.log('physician: ' + JSON.stringify(physician));
				searchResults.physicians.push(physician);
			}
			//console.log('searchResults: ' + JSON.stringify(searchResults));
			res.status(200);
			res.write(JSON.stringify(searchResults));
			res.end();
		});	
		
	});		


});

app.get('/dorefresh', function(req,res) {
	/*	//The following forky call spawns the process over and over again... keep code here in case we want to 
        //play with this some more
        var forky = require('forky');
		forky(__dirname + '/refresh.js', 1, function(err) {
		if (err) {
			console.log('Unable to fork refresh.js - ' + JSON.stringify(err));
			res.status(500).body('error refreshing');
			res.end();
		} else {
			console.log("you spawned 1 worker for refresh.js ");
			res.status(200);
  			res.write('Success.');
  			res.end();
		}
  		
	});
	*/
	// just fork the child process and don't worry about results 
	cp.fork(__dirname + '/refresh.js');
	res.status(200);
  	res.write('Check logs for results.');
  	res.end();
});

var server = app.listen(app.get('port'), function() {
	console.log('Listening on port %d', server.address().port);
});

/*

app.get('/testrefresh', function(req,res) {
	// find all physicians with modification date higher than the list of physicians we have for an org
	// bulk upsert those physicians
	// update the last_modified date for those physicians locally
    var qstr = 'SELECT p.physician_id, p.first_name, p.last_name, p.specialization ' +
  		'FROM "PhysiciansRefresh" pr, "physicians" p ' + 
  		'where pr.physician_id = p.physician_id and ' +
  		'pr.org_id = \'' + orgID + '\' and p.last_modified > pr.last_refreshed limit 200';

	console.log('testrefresh, query = ' + qstr);
	pg.connect(pgConnectionString, function(err, client, done) {
		if (err) {
			console.log('Unable to connect to postgres db. ' + JSON.stringify(err));
			res.status(500).body('error retrieving data');
			return;
		}
		client.query(qstr, function(err, result) {
				
				if (err) {
					console.log('Unable to retrieve physician records from postgres db. - ' + JSON.stringify(err));
					res.status(500);
  					res.write('error retrieving data');
  					res.end();
					done();
					return;
				}
				console.log("total physicians returned: " + result.rows.length);
				if (result.rows.length < 1) {
					console.log('No physician records to update');
					res.status(200);
					res.write('Success');
					res.end();
					done();
					return;
				}
				var physicians = [];
				for (var i = 0; i < result.rows.length; i++) {
					physicians.push(
					{Physician_ID__c: result.rows[i].physician_id,
					Last_Name__c: result.rows[i].last_name,
					First_Name__c: result.rows[i].first_name,
					Specialization__c: result.rows[i].specialization}
					);
				}
				var options = {
   	 				extIdField : "Physician_ID__c"
   				};
   				console.log('in testrefresh, physicians: ' + JSON.stringify(physicians));
   				
   				conn.bulk.load("Physician__c", "upsert", options, physicians, function(err, rets) {
  					if (err) { done(); return console.error(err); }
  					for (var i=0; i < rets.length; i++) {
    					if (rets[i].success) {
     	 					console.log("#" + (i+1) + " upserted successfully, id = " + rets[i].id);
    					} else {
      						console.log("#" + (i+1) + " error occurred, message = " + rets[i].errors.join(', '));
    					}
 	 				}
 	 				// UPDATE physicians SET last_modified='2014-11-06 15:34:00'
 					//	WHERE physician_id in ('Phys6', 'Phys7'); 
 					var timestamp = strftime('%F %H:%M:%S');
 					var physIDs = '';
 					var first = 'true';
 					for (ix in physicians) {
 						if (first != 'true') {
 							physIDs = physIDs + ', ';
 						}
 						first = 'false';
 						physIDs = physIDs + ('\'' + physicians[ix].Physician_ID__c + '\'');
 					}
 					var upstr = 'UPDATE "PhysiciansRefresh" SET last_refreshed=\'' + timestamp +
 						'\' WHERE org_id = \'' + orgID + '\' and physician_id in (' + physIDs + ')';
 					console.log("upstr: " + upstr);
 					
 					client.query(upstr, function(err, result) {
						done(); // release client back to the pool
						if (err) {
							console.log('Unable to update physician records in postgres db. - ' + JSON.stringify(err));
							res.status(500).body('error updating timestamps in physicians data');
							return;
						}
 
  						res.status(200);
  						res.write('Success');
  						res.end();
  					});
 
				});
				
			});					
		});
		

});
*/

/*
app.get('/testbulk', function(req,res) {
	// generate a number for creation of records with unique names
	var startNum = Number((Math.random() * 100) + 1).toFixed(0); // numbers between 1 and 100
	// records to insert, generate 2
	var accounts = [];
	for (i = 0; i < 2; i++) {
		accounts[i] = { Name: 'Bulk' + startNum + '.' + i };
	}
	console.log('About to bulk insert this array: ' + JSON.stringify(accounts));
	
	conn.bulk.load("Account", "insert", accounts, function(err, rets) {
		if (err) { console.error(err); res.send('error'); res.end(); }
  		var msg = '';
  		for (var i=0; i < rets.length; i++) {
    		if (rets[i].success) {
    			msg += "#" + (i+1) + " loaded successfully, id = " + rets[i].id + '\r';

    		} else {
      			msg += "#" + (i+1) + " error occurred, message = " + rets[i].errors.join(', ');
    		}

  		}
  		console.log(msg);
      	res.send(msg + '<br>');
  		res.end();
	});
});
*/

// error handling middleware should be loaded after the loading the routes
/* replaced with our own error handler 
if ('development' == app.get('env')) {
  app.use(errorHandler());
}*/

