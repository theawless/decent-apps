document.getElementById('status').innerHTML = 'Creating server...'
const canvas = document.getElementById('sketchpad')
canvas.height = canvas.clientHeight
canvas.width = canvas.clientWidth

const users = []
const messages = []
const pad = SimpleDrawingBoard.create(canvas)
const bugout = new Bugout({
  seed: localStorage.getItem('decent-pictionary-server-seed'),
  announce: [
    'wss://tracker.openwebtorrent.com',
    'wss://tracker.files.fm:7073/announce',
    'wss://spacetradersapi-chatbox.herokuapp.com:443/announce',
  ],
  iceServers: [{
    urls: ['stun:stun.l.google.com:19302', 'stun:stun.services.mozilla.com']
  }]
})

localStorage.setItem('decent-pictionary-server-seed', bugout.seed)
pad.destroy()

bugout.register('post-message', (address, message, callback) => {
  messages.push({ 'address': address, 'message': message })
  if (messages.length > 16) {
    messages.shift()
  }
  bugout.send({ 'code': 'refresh-messages', 'messages': messages })
  callback({})
  document.getElementById('messages').value = messages.map(m => `${m['address']}: ${m['message']}`).join('\n')
}, 'Post a message to the party')

bugout.register('post-drawing', (_, drawing, callback) => {
  bugout.send({ 'code': 'refresh-drawing', 'drawing': drawing })
  callback({})
  pad.fillImageByDataURL(drawing).then()
}, 'Post a drawing to the party')

bugout.register('list-messages', (_, __, callback) => {
  callback(messages)
}, 'List all messages in the party')

bugout.register('list-users', (_, __, callback) => {
  callback(users)
}, 'List all users in the party')

bugout.register('get-drawing', (_, __, callback) => {
  callback(pad.toDataURL())
}, 'Get drawing in the party')

bugout.once('connections', (_) => {
  document.getElementById('status').innerHTML = 'Listening...'
  const url = location.href.replace('server', 'client')
  const query = `?address=${bugout.address()}`
  document.getElementById('partyLink').href = url + query
  document.getElementById('partyLink').innerText = 'Share this link with your friends!'
})

bugout.on('seen', (address) => {
  users.push({ 'address': address })
  bugout.send({ 'code': 'refresh-users', 'users': users })
  document.getElementById('users').value = users.map(u => u['address']).join('\n')
})

bugout.on('left', address => {
  for (let i = 0; i < users.length; ++i) {
    if (users[i]['address'] === address) {
      users.splice(i, 1)
    }
  }
  bugout.send({ 'code': 'refresh-users', 'users': users })
  document.getElementById('users').value = users.map(u => u['address']).join('\n')
})

window.addEventListener('beforeunload', (_) => {
  bugout.close()
})
