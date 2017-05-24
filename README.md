# Chat Damon

A chat application.

Technologies: Node.js, MongoDB, Express, Socket.IO.

The application can be accessed from the url https://gewtonj-chat.mybluemix.net/.

## Run

- Create an environment variable `VCAP_SERVICES`, with the following JSON
contents: `{"compose-for-mongodb": [{"credentials": {"uri": "mongodb://YOUR_MONGODB_URL"}}]}`
- Execute `node app.js` then open `http://localhost:PORT/`, where 
`PORT` will be shown in the output of the command.

## Features

- The middle of the page shows the messages.
- Below the messages there's a textfield and a button to send messages, as well 
as a check box named "I am busy". If user marks this checkbox, it will show up 
to other users with a red circle around its name, to indicate busy status.
- In the bottom left, there's a list of currently connected users. Each user
is preceded by a circle indicating the status: green for available, red for
busy, and gray for away.
- After 1 minute without posting any messages, an user is automatically marked
as "away". The away status is removed when the next message is sent by the user.
- If an user loses connection or closes the browser, app will wait 30 seconds
before removing user from the connected users list. If user comes back before
30 seconds, it will not be unlisted.
- After 10 minutes of inactivity, users are automatically dropped from the chat,
and session invalidated.
- In the bottom right, there are some more options. Currently, only "logout"
is available. Clicking on the "logout" link will immediately remove the user from the
chat and invalidate session.