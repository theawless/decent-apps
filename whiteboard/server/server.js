class Server {
  /**
   * @param {SimpleDrawingBoard} pad
   * @param {WebSocket} socket
   * @param {{peer: string, party: string, pass: string}} options
   */
  constructor (pad, socket, { peer, party, pass }) {
    this._pad = pad
    this._messages = []
    this._user = new window.decentSignal.DSWebtorrentTrackerUser(peer, party)
    const tracker = new window.decentSignal.DSWebtorrentTracker(socket, this._user)
    const crypto = new window.decentSignal.DSWebCrypto(window.crypto)
    const secret = new window.decentSignal.DSSecretParty(tracker, crypto, { party, pass })
    const service = new window.decentSignal.DSChannelAsService(secret)
    const store = new window.decentSignal.DSInMemoryKeystore()
    const system = new window.decentSignal.DSSharedSecretSystem(crypto, store)
    const comm = new window.decentSignal.DSCommunicator(service, system)
    this._signal = new window.decentSignal.DSWebrtcSignaller(comm)
    this._peers = new Map() // user id to peer
    this._onUserFound = (...args) => this._handleUserFound(...args).then()
    this._onUserLeft = (user) => this._handleUserLeft(user)
  }

  async start () {
    this._signal.events.on('user-found', this._onUserFound)
    this._signal.events.on('user-left', this._onUserLeft)
    await this._signal.start()
    setStatus("Listening...")
  }

  async stop () {
    for (const peer of this._peers.values()) {
      peer.close()
    }
    this._peers.clear()
    this._signal.events.off('user-found', this._onUserFound)
    this._signal.events.off('user-left', this._onUserLeft)
    await this._signal.stop()
  }

  /**
   * Log when the user leaves.
   * @param {DSUser} user
   */
  _handleUserLeft (user) {
    console.info(`User ${user.id} left.`)
  }

  /**
   * Setup peer and feed and initiate/respond to signalling.
   * @param {DSUser} user
   * @param {(DSWebrtcPeer) => Promise<void>} connect
   */
  async _handleUserFound (user, connect) {
    const factory = (initiator) => {
      console.info(`Connecting with ${user.id}, we are initiator: ${initiator}.`)
      const peer = new window.SimplePeer({ initiator, trickle: false })
      this._setupPeer(user, peer)
      return peer
    }
    await connect(new window.decentSignal.DSSimplePeer(factory))
    console.info(`Webrtc connection with user ${user.id} successful`)
  }

  /**
   * @param {DSUser} user
   * @param {SimplePeer} peer
   */
  _setupPeer (user, peer) {
    peer.on('connect', () => {
      if (this._peers.has(user.id)) {
        console.info(`Closing old webrtc connection with user ${user.id}.`)
        this._peers.get(user.id).destroy()
        this._peers.delete(user.id)
      }
      this._peers.set(user.id, peer)
      this._updateUsers()
    })
    peer.on('data', (data) => {
      const { kind, text } = JSON.parse(data)
      if (kind === 'set-drawing') {
        this._pad.fillImageByDataURL(text).then()
      } else if (kind === 'add-message') {
        if (this._messages.length === 100) {
          this._messages.shift()
        }
        this._messages.push({ 'id': user.id, 'message': text })
        this._updateMessages(user, text)
      } else if (kind === 'get-drawing') {
        peer.send(JSON.stringify({
          kind: 'take-drawing',
          text: this._pad.toDataURL()
        }))
      } else if (kind === 'get-messages') {
        peer.send(JSON.stringify({
          kind: 'take-messages',
          text: this._messages
        }))
      }
    })
    peer.on('close', () => {
      console.info(`Closed webrtc connection with user ${user.id}.`)
      this._peers.delete(user.id)
      this._updateUsers()
    })
    peer.on('error', () => {
      console.info(`Errored webrtc connection with user ${user.id}.`)
      this._peers.delete(user.id)
      this._updateUsers()
    })
  }

  /**
   * Show the webrtc peers on the UI.
   */
  _updateUsers () {
    let text = ''
    for (const user of this._peers.keys()) {
      text += `${user}\n`
    }
    document.getElementById('users').textContent = text
  }

  /**
   * Show the webrtc messages on the UI.
   * @param {DSUser} from
   * @param {string} message
   */
  _updateMessages (from, message) {
    let text = ''
    for (const [user, message] of this._messages) {
      text += `${user}:${message}\n`
    }
    const area = document.getElementById('messages')
    area.textContent = text
    area.scrollTop = area.scrollHeight
  }

}

/**
 * Updates the party link.
 * @param {string} peer
 * @param {string} party
 * @param {string} pass
 */
function setLink (peer, party, pass) {
  const url = location.href.replace('server', 'client')
  const params = new URLSearchParams()
  params.set('peer', btoa(peer))
  params.set('party', btoa(party))
  params.set('pass', btoa(pass))
  link.href = url + params.toString()
  link.innerText = 'Share this link with your friends!'
}

/**
 * Updates the status on the page.
 * @param {string} text
 */
function setStatus (text) {
  document.getElementById('status').innerHTML = text
}

/**
 * Generate a random binary string.
 * @param {number} size
 * @returns {string}
 */
function randomBinary (size) {
  const array = window.crypto.getRandomValues(new Uint8Array(20))
  const binary = new Array(size)
  for (let i = 0; i < size; ++i) {
    binary[i] = String.fromCharCode(array[i])
  }
  return binary.join('')
}

async function main () {
  setStatus('Ready...')
  const pad = window.SimpleDrawingBoard.create(canvas)
  pad.destroy()
  const socket = new window.WebSocket('wss://tracker.openwebtorrent.com')
  socket.onclose = (event) => {
    setStatus('Tracker connect failed...')
    console.info(`Socket closed due to ${event.code}: ${event.reason}`)
  }
  await new Promise(resolve => {socket.onopen = (_) => resolve()})
  const peer = randomBinary(20)
  const party = randomBinary(20)
  const pass = randomBinary(8)
  const demo = new Server(pad, socket, { peer, party, pass })
  await demo.start()
  setLink(peer, party, pass)
  const clean = (event) => {
    setStatus('Closing...')
    demo.stop().then(() => {
      window.removeEventListener('beforeunload', clean)
      setStatus('Closed...')
    })
    event.preventDefault()
    event.returnValue = ''
  }
  window.addEventListener('beforeunload', clean)
}

const canvas = document.getElementById('sketchpad')
const link = document.getElementById('link')

main().then()
