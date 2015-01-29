/*
Copyright (c) 2011, salesforce.com, Inc.
All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

    * Redistributions of source code must retain the above copyright notice,
    this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright notice,
    this list of conditions and the following disclaimer in the documentation
    and/or other materials provided with the distribution.
    * Neither the name of the salesforce.com, Inc. nor the names of its contributors
    may be used to endorse or promote products derived from this software
    without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT,
INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE
OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED
OF THE POSSIBILITY OF SUCH DAMAGE.
*/

/* Secure coding middleware */
function SecurityHandler (pgConnectionString) {
	var localmode = pgConnectionString.search('localhost') != -1;

    this.requireHTTPSMiddleware = function(req, res, next) {    	
		if (!localmode) { 
			if (req.headers['x-forwarded-proto'] && req.headers['x-forwarded-proto'] === "http") {
				console.log("Caught request over http. Redirecting to: " + "https://" + req.headers.host + req.url);
				return res.redirect("https://" + req.headers.host + req.url);
			}
		} 
		return next();	
    }
    
    this.requirePostHeadersMiddleware = function(req, res, next) {
    	if (req.method == 'POST') {
    		res.header('X-Frame-Options', 'Deny');
    		res.header('Cache-control' , 'no-store' );
    		res.header('Pragma' , 'no-cache' );
    	}
    	return next();
    }
}

module.exports = SecurityHandler;


