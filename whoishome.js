'use strict';
var cheerio  = require('cheerio');
var request  = require('request');
var mongoose = require('mongoose');

var dbURL = 'mongodb://localhost:27017/wifiDB';

mongoose.connect(dbURL, function(err){
    if(err){
      console.log("Mongoose connection failed.");
      throw err;
    }
});

var deviceRecordSchema = mongoose.Schema({
  name : String,
  ipAddress : String,
  connectionType : String,
  lanIPAddressAllocation : String,
  ipAddressType : String,
  macAddress : String,
  status : String,
  timestamp : { type: Date, default: Date.now }
});

var DeviceRecord = mongoose.model('DeviceRecord', deviceRecordSchema);

var router_addr = 'http://192.168.100.254/';
var async_counter;

/** Send main page request. */
/*  */
new Promise(function(fulfill, reject) {
    request( router_addr, function (err, response, html) {
        if(err){ reject( new Error('Could not complete the request.') ); }
        else{ fulfill(html); }
    })
})/** Then load the html. */
.then( function(html) {
    return cheerio.load(html);
})/** Get links for each device in the table and create a promise. */
.then( function($) {
    var detailLinks = $(".colortable a");
    async_counter = detailLinks.length;

    for(var i=0; i < detailLinks.length ;i++){

      /** For every fetched link, create a promise. */
      new Promise( function(fulfill, reject){

        request(router_addr + detailLinks[i].attribs.href, function(err, response, html){
          if(err){ reject( new Error('Could not fetch the device details.') ); }
          else{ fulfill(html); }
        });
      })/** Load the detail page. */
      .then( function(html){
        return cheerio.load(html);
      })/** Get the device information here. */
      .then( function($){
        var newDeviceRecord = new DeviceRecord();

        newDeviceRecord.name = $('h3').text().substring(6);
        newDeviceRecord.ipAddress = $('.textmono').text();
        var detailsList = $('h3').next().children();
        newDeviceRecord.connectionType = detailsList[0].children[0].data.substring(17);
        newDeviceRecord.lanIPAddressAllocation = detailsList[2].children[0].data.substring(27);
        newDeviceRecord.ipAddressType = detailsList[3].children[0].data.substring(17);
        newDeviceRecord.macAddress = detailsList[4].children[0].data.substring(18);
        newDeviceRecord.status = detailsList[6].children[0].data.substring(8);

        return newDeviceRecord;
      })/* Put the record into MongoDB. */
      .then(function(newDeviceRecord){
        console.log(newDeviceRecord);
        newDeviceRecord.save(function(err){
          async_counter--;
          if(!async_counter){ mongoose.connection.close(); }
        });
      })
    }
});
