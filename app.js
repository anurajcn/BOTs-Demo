const env = require('dotenv')
env.config();
var builder = require('botbuilder');
var restify = require('restify');
var githubClient = require('./github-client.js');

var connector = new builder.ChatConnector({
    appid: process.env.MICROSOFT_APP_ID,
    apppassword:process.env.MICROSOFT_APP_PASSWORD
}

);
var bot = new builder.UniversalBot(
    connector,
    (session)=>{
      session.endConversation("Hi I am github search Bot")
    }

    
);

const recognizer = new builder.LuisRecognizer(process.env.LUIS_MODEL_URL);
 recognizer.onEnabled((context,callback) =>{
     if(context.dialogStack().length >0){
         callback(null,false);
     }
     else{
         callback(null,true);
     }
 })
    bot.recognizer(recognizer);


bot.dialog('search', [
    (session,args,next) => {
        const query = builder.EntityRecognizer.findEntity(args.intent.entity,'query');
        if(!query){
            builder.Prompts.text(session, 'Who are you looking for?');
           
        }
        else{
            
            next({response:query.entity});
            };
        },
        (session,results,next) => {
            var query = results.response;
            if(!query){
                session.endDialog("Request Cancelled")
            }
            else{
                githubClient.executeSearch(query, (profiles)=>{
                    var totalCount = profiles.total_count;
                    if(totalCount ==0){
                        session.endDialog("sorry No results found")
                    }
                    else if(totalCount > 10){
                        session.endDialog("too many results, please refine your search")
                    }
                    else{
                        session.dialogData.property = null;
                        var usernames = profiles.items.map((item)=>{return item.login});
                        builder.Prompts.choice(
                            session,'Please choose a user',
                            usernames,
                            {listStyle:builder.ListStyle.button}
                        );
                    }

                    });
                }
        
    
            },
            (session,results,next)=> {
                session.sendTyping();
                var username = results.response.entity;
                githubClient.loadProfile(username, function (profile) {
                    var card = new builder.ThumbnailCard(session);
        
                    card.title(profile.login);
                    card.images([builder.CardImage.create(session, profile.avatar_url)]);
                    if (profile.name) card.subtitle(profile.name);
        
                    var text = '';
                    if (profile.company) text += profile.company + ' \n';
                    if (profile.email) text += profile.email + ' \n';
                    if (profile.bio) text += profile.bio;
                    card.text(text);
        
                    card.tap(new builder.CardAction.openUrl(session, profile.html_url));
                    
                    var message = new builder.Message(session).attachments([card]);
                    session.send(message);
                });
            }
        

    
]).triggerAction({
    matches:'SearchProg'
})


var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});
server.post('/api/messages', connector.listen());