import React, { useState, useEffect, useRef } from 'react'
import { Result, Row, Col, Input, Button, message, Modal, Tag, PageHeader, Tooltip, Space, Switch } from 'antd'
import { MessageList, Input as MsInput, Button as MsButton } from 'react-chat-elements'
import io from 'socket.io-client'
import Pear from 'simple-peer'
import 'antd/dist/antd.css'
import 'react-chat-elements/dist/main.css'
import './style.css'

import { LikeFilled, DislikeFilled, HeartFilled, SmileFilled } from '@ant-design/icons'
import Emotion from './Emotion'

let socket
document.title = 'RealTalk'
export default function App() {
  const [stream, setStream] = useState()
  const [myId, setMyId] = useState()
  const [callId, setCallId] = useState()
  const [callAccepted, setCallAccepted] = useState(false)
  const [callRecieve, setCallRecieve] = useState()
  const [caller, setCaller] = useState()
  const [messages, setMessage] = useState([
    {
      title: 'RealTalk - BOT',
      position: 'left',
      type: 'text',
      text: 'Chào mừng đến với RealTalk!',
      date: new Date(),
    }
  ])
  const [messInput, setMessInput] = useState()
  const [emotion, setEmotion] = useState()
  const [emotionBlocked, setEmotionBlocked] = useState(false)

  const myVideo = useRef()
  const parnerVideo = useRef()


  useEffect(() => {
    socket = io('http://localhost:3001')

    navigator.mediaDevices.getUserMedia({ video: true, audio: false }).then(stream => {
      setStream(stream)
      myVideo.current.srcObject = stream
    })

    socket.on('myID', id => {
      setMyId(id)
    })

    socket.on('notFound', to => {
      console.log('Not found ID', to)
      message.error('Không tìm thấy ID')
    })

    socket.on('message', ({ from, message }) => {
      setMessage(mess => [
        ...mess,
        {
          title: from,
          position: 'left',
          type: 'text',
          text: message,
          date: new Date()
        }
      ])
    })

    socket.on('emotion', icon => {
      setEmotion(icon)
    })
  }, [])

  useEffect(() => {
    socket.on('rang', ({ signal, from }) => {
      console.log({ callAccepted })
      if (callAccepted) {
        console.log('busy from', from)
        socket.emit('busy', { to: from, from: myId })
      } else {
        setCallRecieve(true)
        setCaller({ id: from, signal })
      }
    })
  }, [callAccepted])

  useEffect(() => {
    if (caller && callRecieve && !callAccepted) {
      Modal.confirm({
        title: `Cuộc gọi từ ${caller?.id}`,
        okText: 'Chấp nhận',
        onOk: acceptCall,
        cancelText: 'Từ chối',
        onCancel: declineCall
      })
    }
  }, [caller])

  function handleCall() {
    if (callId === myId) {
      message.error('Mã ID không được hợp lệ')
      return
    }
    const pear = new Pear({
      initiator: true,
      trickle: false,
      stream
    })

    const hide = message.loading('Đang gọi...', 0)

    pear.on('signal', data => {
      socket.emit('call', { to: callId, signal: data, from: myId })
    })

    pear.on('stream', stream => {
      message.success('Kết nối thành công!')
      parnerVideo.current.srcObject = stream
      setMessage(mess => [
        ...mess,
        {
          title: 'RealTalk - BOT',
          position: 'left',
          type: 'text',
          text: `${callId} đã tham gia cuộc gọi. Hãy thử trò chuyện với nhau!`,
          date: new Date()
        }
      ])
    })

    socket.on('busy', from => {
      hide()
      message.error(`${from} đang bận!`)

      socket.off('busy')
      socket.off('callDeclined')
      socket.off('callAccepted')
      socket.off('endCall')
      pear.destroy()
    })

    socket.on('callAccepted', signal => {
      hide()
      setCallAccepted(true)
      pear.signal(signal)
    })

    socket.on('callDeclined', from => {
      hide()
      message.error(`${from} đã từ chối cuộc gọi`)

      socket.off('busy')
      socket.off('callDeclined')
      socket.off('callAccepted')
      socket.off('endCall')
      pear.destroy()
    })

    socket.on('endCall', () => {
      message.error(`Cuộc gọi đã kết thúc`)

      socket.off('busy')
      socket.off('callDeclined')
      socket.off('callAccepted')
      socket.off('endCall')
      setCallId(undefined)
      setCallAccepted(false)
      pear.destroy()
    })
  }

  function acceptCall() {
    setCallAccepted(true)
    const pear = new Pear({
      initiator: false,
      trickle: false,
      stream
    })

    pear.on('signal', data => {
      socket.emit('accept', { to: caller?.id, signal: data })
    })

    pear.on('stream', stream => {
      message.success('Kết nối thành công!')
      parnerVideo.current.srcObject = stream
      setMessage(mess => [
        ...mess,
        {
          title: 'RealTalk - BOT',
          position: 'left',
          type: 'text',
          text: `${caller?.id} đã tham gia cuộc gọi. Hãy thử trò chuyện với nhau!`,
          date: new Date()
        }
      ])
    })

    pear.signal(caller?.signal)

    socket.on('endCall', () => {
      message.error(`Cuộc gọi đã kết thúc`)

      socket.off('endCall')
      setCaller(undefined)
      setCallAccepted(false)
      pear.destroy()
    })
  }

  function declineCall() {
    socket.emit('decline', { to: caller?.id, from: myId })
  }

  function handleEnd() {
    setCallAccepted(false)
    socket.emit('end', { to: caller?.id || callId, from: myId })
  }

  function handleSendMessage(message) {
    socket.emit('send', { to: caller?.id || callId, from: myId, message })
    setMessage(mess => [
      ...mess,
      {
        title: 'Bạn',
        position: 'right',
        type: 'text',
        text: message,
        date: new Date()
      }
    ])
    setMessInput('')
  }

  function handleIdClick() {
    navigator.clipboard.writeText(myId).then(() => {
      message.success('Đã sao chép')
    })
  }

  function handleEmotion(icon){
    setEmotion(icon)
    socket.emit('emotion', { to: caller?.id || callId, icon })
  }

  if (!navigator.mediaDevices && !navigator.mediaDevices.getUserMedia) {
    return <Result status='500' title='Trình duyệt không tương thích!' />
  }

  return (
    <div>
      <PageHeader title='RealTalk' style={{ boxShadow: '0px 1px 5px gray' }} />
      <Row>
        <Tooltip title='Nhấn để sao chép' placement='right'>
          <div style={{ margin: '20px auto', fontSize: '20px', fontWeight: 'bold' }}>
            Mã ID: <Tag onClick={handleIdClick} style={{ padding: '10px 20px', fontSize: 22, cursor: 'pointer' }}>{myId}</Tag>
          </div>
        </Tooltip>
      </Row>
      <Row>
        <div style={{ width: 400, margin: '0px auto' }}>
          <Input placeholder="Nhập ID..." style={{ margin: '10px 0' }} onChange={e => setCallId(e.target.value)} value={callId} />
          <Button style={{ margin: '10px 0' }} block type='primary' onClick={handleCall}>Gọi</Button>
          {callAccepted && <Button block type='danger' onClick={handleEnd}>Kết thúc</Button>}
        </div>
      </Row>
      <Row>
        <Col span={8} style={{ padding: 10 }}>
          <video style={{ width: '100%', height: 250, background: 'black' }} autoPlay ref={myVideo}></video>
          <div>
            <MessageList
              className='message-list'
              lockable={true}
              toBottomHeight={300}
              dataSource={messages}
            />
            <Input
              placeholder='Nhập tin nhắn...'
              value={messInput}
              onChange={e => setMessInput(e.target.value)}
              onPressEnter={e => handleSendMessage(e.target.value)}
              allowClear
              style={{ margin: '10px 0' }}
            />
            <Space>
              <Button icon={<LikeFilled />} onClick={() => handleEmotion('LikeFilled')} />
              <Button icon={<DislikeFilled />} onClick={() => handleEmotion('DislikeFilled')} />
              <Button icon={<HeartFilled />} onClick={() => handleEmotion('HeartFilled')} />
              <Button icon={<SmileFilled />} onClick={() => handleEmotion('SmileFilled')} />
            </Space>
            <Switch
              style={{display:'block', margin: '10px 0'}}
              checkedChildren='Biểu cảm đang bật'
              unCheckedChildren='Biểu cảm đang tắt'
              defaultChecked
              onChange={(val) => setEmotionBlocked(!val)}
            />
          </div>
        </Col>
        <Col span={16} style={{ padding: '10px 10px 10px 0' }}>
          <video style={{ width: '100%', height: '90vh', background: 'black' }} autoPlay ref={parnerVideo}></video>
        </Col>
      </Row>
      <Emotion icon={emotion} setIcon={setEmotion} blocked={emotionBlocked}/>
    </div>
  )
}
