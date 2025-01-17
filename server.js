/**
 * Copyright 2019 Artificial Solutions. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *    http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const MessagingResponse = require('twilio').twiml.MessagingResponse;
const TIE = require('@artificialsolutions/tie-api-client');

const port = process.env.PORT || 4337;
const teneoEngineUrl = process.env.TENEO_ENGINE_URL;

const app = express();

// initalise teneo
const teneoApi = TIE.init(teneoEngineUrl);

// initialise session handler, to store mapping between sender's phone number and the engine session id
const sessionHandler = SessionHandler();

app.use(bodyParser.urlencoded({ extended: false }));

// twilio message comes in
app.post("/", handleTwilioMessages(sessionHandler));

// handle incoming twilio message
function handleTwilioMessages(sessionHandler) {
  return async (req, res) => {

    // get the sender's phone number
    const from = req.body.From;
    console.log(`from: ${from}`);

    // get message from user
    const userInput = req.body.Body;
    console.log(`userInput: ${userInput}`);

    // check if we have stored an engine sessionid for this sender
    const teneoSessionId = sessionHandler.getSession(from);

    // send input to engine using stored sessionid and retreive response
    const teneoResponse = await teneoApi.sendInput(teneoSessionId, { 'text': userInput, 'channel': 'twilio-whatsapp' });
    console.log(`teneoResponse: ${teneoResponse.output.text}`)

    // store engine sessionid for this sender
    sessionHandler.setSession(from, teneoResponse.sessionId);

    // return teneo answer to twilio
    sendTwilioMessage(teneoResponse, res);
  }
}

// compose and send message
function sendTwilioMessage(teneoResponse, res) {

  const usermsg = teneoResponse.output.text;
  const twiml = new MessagingResponse();
  
//Start of testing...  
//From the twilio api doc, you can send MMS, text and image. But worked once and now is not working
  if((teneoResponse.output.parameters != null) &&
     (Object.keys(teneoResponse.output.parameters).length > 0)){
     //Now look for a parameter called "whatsapp-media"
     console.log('teneo parameters found');
     if ((teneoResponse.output.parameters.imageUrl != null) &&
        (teneoResponse.output.parameters.imageUrl.length > 0)){
          console.log('teneo showImage parameter found');
          const message = twiml.message();
          console.log('Message before setting: '+message.toString());
          console.log('twiml before setting: '+twiml.toString());
          message.body(usermsg); //text in the body
          message.media(teneoResponse.output.parameters.imageUrl);
          //nothing more to do, twiml is populated now
     }//end if
     else{//there are parameters, but not the one I am looking for, so I pass the user message
       twiml.message(usermsg); 
     }
  }//end if
  else{
    twiml.message(usermsg); //No parameters
  }
  //End testing, remove the following line if testing again
  //twiml.message(usermsg); //No parameters
    
  res.writeHead(200, { 'Content-Type': 'text/xml' });
  console.log('Message to send back: ' + twiml.toString());
  res.end(twiml.toString());
}


/***
 * SESSION HANDLER
 ***/
function SessionHandler() {

  // Map the sender's phone number to the teneo engine session id. 
  // This code keeps the map in memory, which is ok for testing purposes
  // For production usage it is advised to make use of more resilient storage mechanisms like redis
  const sessionMap = new Map();

  return {
    getSession: (userId) => {
      if (sessionMap.size > 0) {
        return sessionMap.get(userId);
      }
      else {
        return "";
      }
    },
    setSession: (userId, sessionId) => {
      sessionMap.set(userId, sessionId)
    }
  };
}

http.createServer(app).listen(port, () => {
  console.log(`Express server listening on port ${port}`);
});
