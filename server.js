// server.js
// load the things we need
var express = require('express');
var app = express();
var SolrNode = require('solr-node');
var fs = require('fs');
var SpellCorrector = require('spelling-corrector');
const cheerio = require('cheerio')
	
// set the view engine to ejs
app.set('view engine', 'ejs');

var client = new SolrNode({
	host: '127.0.0.1',
	port: '8983',
	core: 'hw4',
	protocol: 'http'
});

var htmlDir = '../../Newsday/HTML Files/';

var spellCorrector = new SpellCorrector();
spellCorrector.loadDictionary('big.txt');
// spellCorrector.loadDictionary();

// Load CSV file into dictionary
var urlToHtmlCsv = fs.readFileSync('UrlToHtml_Newday.csv').toString();
var urlHtmlMap = {};

urlToHtmlCsv.split("\n").forEach(function(line) {
	var pair = line.toString().split(",");
	if(pair[0].length) {
		urlHtmlMap[pair[0]] = pair[1];
	}
});

var findSnippet = function(docID, queryString) {
	var queryTerms = queryString.split(' ');

	var allTermString = '';
	var anyOrderTermString = '';
	var anyTermString = '';
	for(var term of queryTerms) {
		allTermString += '(' + term + ').*';
		anyOrderTermString += '(?=.*\b' + term + '\b)';
		anyTermString += '\\b' + term + '\\b|';
	}
	anyTermString = anyTermString.slice(0,-1);

	var allTerms = new RegExp(allTermString,'i');
	var anyOrderTerms = new RegExp(anyOrderTermString,'i');
	var anyTerm = new RegExp(anyTermString,'i');


	const $ = cheerio.load(fs.readFileSync(docID).toString());

	/* Best snippet criteria used
	* 3. Match all terms together
	* 2. All terms, different order
	* 1. Only 1 query term
	* 0. none found
	*/

	var bestSentence = '';

	var allParagraphs = $('p');
	// Look for an exact match of all terms
	allParagraphs.each(function(i, elem) {
		var sentences = [$(this).text().trim()];
		for(var sentence of sentences) {
			if(allTerms.test(sentence)) {
				bestSentence = sentence;
				return false;
			} 
		}
	});

	if(bestSentence !== '') {
		return bestSentence;
	}

	// Look for all terms in any order
	allParagraphs.each(function(i, elem) {
		var sentences = [$(this).text().trim()];
		for(var sentence of sentences) {
			if(anyOrderTerms.test(sentence)) {
				bestSentence = sentence;
				return false;
			} 
		}
	});

	if(bestSentence !== '') {
		return bestSentence;
	}

	// Look for first sentence with any term
	allParagraphs.each(function(i, elem) {
		var sentences = [$(this).text().trim()];
		// var sentences = $(this).text().trim().split('.');
		for(var sentence of sentences) {
			if(anyTerm.test(sentence)) {
				bestSentence = sentence;
				return true;
			}
		}
	});

	return bestSentence;
}

// index page 
app.get('/', function(req, res) {
	if(req.query.q) {
		
		var queryString = req.query.q;
		var queryWords = queryString.toLowerCase().split(' ');
		var searchType = req.query.searchType ? req.query.searchType : 'lucene';

		var query = client.query().q(queryString).qop('AND');
		if(searchType === 'pageRank') {
			query = client.query().q(queryString).qop('AND').sort({'pageRankFile':'asc'});
		}

		client.search(query, function(err, result) {
			if(err) {
				console.log(err);
				return;
			}

			result.response.docs.forEach(function(docObj) {
				var snippet = findSnippet(docObj.id, queryString);
				if(snippet.length > 160) {
					var firstHalf = snippet.slice(0,160);
					
					var containsQueryWords = false;
					for(var word of queryWords) {
						if(firstHalf.toLowerCase().indexOf(word) >= 0) {
							containsQueryWords = true;
							break;
						}
					}

					if(!containsQueryWords) {
						snippet = '...' + snippet.slice(-160);
					} else {
						snippet = firstHalf + '...';
					}
				}

				var highlightedSnippet = "";
				for(var word of snippet.split(' ')) {
					cleanedWord = word.replace(/\W/g, '').toLowerCase();
					if(queryWords.indexOf(cleanedWord) >= 0) {
						highlightedSnippet += '<b>' + word + '</b> ';
					} else {
						highlightedSnippet += word + ' ';
					}
				}

				docObj.snippet = highlightedSnippet;
				if(!docObj.og_url) {
					var docId = docObj.id.split('/');
					var url = docId[docId.length-1];
					docObj.og_url = urlHtmlMap[url];
				}
			});

			// Correct misspelled words in query
			var correctedWords = [];
			for(word of queryString.split(' ')) {
				correctedWords.push(spellCorrector.correct(word));
			}

			res.render('pages/index', {
				query: queryString,
				correction: correctedWords.join(' '),
				searchType: searchType,
				results: true,
				numResults: result.response.numFound,
				docs: result.response.docs,
			});
		});

	} else {
		console.log("no query");
		res.render('pages/index', {
			results: false,
			query: '',
			searchType: 'lucene'
		});
	}
});

app.get('/search', function(req, res){
	var data=[];
	for(i=0;i<10;i++)
	{
		data.push("testing " + i);
	}
	res.end(JSON.stringify(data));
});

app.listen(8080);
console.log('running on localhost:8080');