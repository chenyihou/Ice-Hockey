const app = require('http').createServer(handler)
const io = require('socket.io')(app) //wrap server app in socket io capability
const fs = require("fs") //need to read static files
const url = require("url") //to parse url strings

const PORT = process.env.PORT || 3000

let players = []
let balls = []

// initialize the state of balls
const initializeBalls = () => {
    balls = []
    for (let i = 0; i < 6; i++) {
        let x = 515 + i * 24
        let y = 447
        // position of ball
        let r = 10
        // radius of ball
        let v = vx = vy = 0
        let color = i < 3 ? 'yellow' : 'pink'
        let collised = -1
        // collised is used to determine whether it 
        // has already checked collised in one round 
        // of inspectation
        balls.push({
            x,
            y,
            r,
            v,
            vx,
            vy,
            i,
            collised,
            color
        })
    }
}

initializeBalls()

const dealCollision = () => {
    // copy from given java file
    balls.forEach(ball1 => {
        if (ball1.v !== 0) {
            if (ball1.x >= 650 - ball1.r) {
                ball1.vx *= -1
                ball1.x = 650 - ball1.r
            } else if (ball1.x < 500 + ball1.r) {
                ball1.vx *= -1
                ball1.x = 500 + ball1.r
            }
            if (ball1.y >= 460 - ball1.r) {
                ball1.vy *= -1
                ball1.y = 460 - ball1.r
            } else if (ball1.y < 0 + ball1.r) {
                ball1.vy *= -1
                ball1.y = 0 + ball1.r
            }
            balls.forEach(ball2 => {
                if (ball1 == ball2 || ball1.collised === ball2.i) return
                let v = ball1.v
                let dx = Math.abs(ball2.x - ball1.x)
                let dy = Math.abs(ball1.y - ball2.y)
                let dist12 = Math.sqrt(dx * dx + dy * dy)
                if (dist12 > ball1.r * 2) return
                ball2.collised = ball1.i
                ball1.collised = ball2.i
                let angle_b = Math.asin(dy / dist12)
                let angle_d = Math.asin(Math.abs(ball1.vx / v))
                let angle_a = (3.14159 / 2.0) - angle_b - angle_d
                let angle_c = angle_b - angle_a
                v1 = v * Math.abs(Math.sin(angle_a))
                v2 = v * Math.abs(Math.cos(angle_a))
                let v1x = v1 * Math.abs(Math.cos(angle_c))
                let v1y = v1 * Math.abs(Math.sin(angle_c))
                let v2x = v2 * Math.abs(Math.cos(angle_b))
                let v2y = v2 * Math.abs(Math.sin(angle_b))
                if (ball1.vx > 0) { //ball1 is going right
                    if (ball1.x < ball2.x)
                        v1x = -v1x;
                    else
                        v2x = -v2x;
                } else {
                    if (ball1.x > ball2.x)
                        v2x = -v2x;
                    else
                        v1x = -v1x;
                }

                //set vertical directions
                if (ball1.vy > 0) { //ball1 is going right
                    if (ball1.y < ball2.y)
                        v1y = -v1y;
                    else
                        v2y = -v2y;
                } else {
                    if (ball1.y > ball2.y)
                        v2y = -v2y;
                    else
                        v1y = -v1y;
                }

                //if(ball1.vy < 0) {v1y = -v1y; v2y = -v2y;} 
                ball1.vx = v1x //set new velocities for Balls
                ball1.vy = v1y
                ball2.vx = v2x
                ball2.vy = v2y
                ball2.v = Math.sqrt(v2x * v2x + v2y * v2y)
            })
        }
    })
}

const update = () => {

    // reset ball.collised
    balls.forEach(ball => {
        ball.collised = -1
    })

    // change the state if the collision happens
    dealCollision()

    // slow the balls
    balls.forEach(ball => {
        if (ball.v === 0) return
        console.log(ball)
        ball.x += ball.vx
        ball.y += ball.vy
        ball.vx *= 0.95
        ball.vy *= 0.95
        ball.v *= 0.95
        if (Math.abs(ball.vx) < 0.0001)
            ball.vx = 0
        if (Math.abs(ball.vy) < 0.0001)
            ball.vy = 0
        if (ball.v < 0.0001)
            ball.v = 0
    })
}

app.listen(PORT)
//server maintained location of moving box
io.on('connection', function(socket) {
    io.emit('ballsLocation', JSON.stringify(balls))
    socket.on('ballsLocation', function(data) {

        //to broadcast message to everyone including sender:
        io.emit('ballsLocation', data) //broadcast to everyone including sender
    })
    socket.on('switchTurn', data => {
        io.emit('switchTurn', data)
    })
    socket.on('register', data => {
        io.emit('newPlayer', JSON.stringify(players))
        if (players.length === 2) {
            // two players, start game
            io.emit('gameStart')
        }
    })
    socket.on('renewBelt', data => {
        io.emit('renewBelt', data)
    })
    socket.on('catapult', data => {
        io.emit('renewBelt', JSON.stringify({}))
        io.emit('ballsLocation', data)
        balls = JSON.parse(data)
    })
    socket.on('quit', data => {
        if (players.length === 2 && (data === players[0].name || data === players[1].name)) {
            // this message should be sent by one present player
            players = []
            initializeBalls()
            io.emit('gameEnd')
        // let front end reset all states
        }
    })
    // main game
    setInterval(() => {
        update()
        io.emit('ballsLocation', JSON.stringify(balls))
    }, 1000 / 24)
})

const ROOT_DIR = "src" //dir to serve static files from

const MIME_TYPES = {
    css: "text/css",
    gif: "image/gif",
    htm: "text/html",
    html: "text/html",
    ico: "image/x-icon",
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    js: "application/javascript",
    json: "application/json",
    png: "image/png",
    svg: "image/svg+xml",
    txt: "text/plain"
}


function get_mime(filename) {
    for (let ext in MIME_TYPES) {
        if (filename.indexOf(ext, filename.length - ext.length) !== -1) {
            return MIME_TYPES[ext]
        }
    }
    return MIME_TYPES["txt"]
}

function handler(request, response) {
    let urlObj = url.parse(request.url, true, false)
    let receivedData = ""

    //attached event handlers to collect the message data
    request.on("data", function(chunk) {
        receivedData += chunk
    })

    //event handler for the end of the message
    request.on("end", function() {
        if (request.method === 'POST') {
            response.writeHead(200, {
                "Content-Type": get_mime('json')
            })
            console.log(players.length)
            if (players.length === 2) {
                // players are full, reject
                response.end(JSON.stringify({
                    authentication: false,
                    msg: 'There are two players now, please wait'
                }))
            } else {
                let user = JSON.parse(receivedData)
                if (players[0] && players[0].team === user.team) {
                    // selected color, reject
                    response.end(JSON.stringify({
                        authentication: false,
                        msg: 'This team is already selected'
                    }))
                } else {
                    players.push(user)
                    response.end(JSON.stringify({
                        authentication: true
                    }))
                }
            }
        }

        if (request.method == "GET") {
            //handle GET requests as static file requests
            fs.readFile(ROOT_DIR + urlObj.pathname, function(err, data) {
                if (err) {
                    //report error to console
                    console.log("ERROR: " + JSON.stringify(err))
                    //respond with not found 404 to client
                    response.writeHead(404)
                    response.end(JSON.stringify(err))
                    return
                }
                response.writeHead(200, {
                    "Content-Type": get_mime(urlObj.pathname)
                })
                response.end(data)
            })
        }
    })
}

console.log("Server Running at PORT: 3000  CNTL-C to quit")
console.log("To Test:")
console.log("Open several browsers at: http://localhost:3000/icehockey.html")