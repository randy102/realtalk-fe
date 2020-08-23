import React from 'react'
import * as Icon from '@ant-design/icons'
import './emotion.css'

export default function Emotion({ icon, setIcon, blocked }) {
  if (blocked) {
    setIcon(undefined)
  } 
  else if (icon) {
    const EmotionIcon = Icon[icon]
    setTimeout(() => {setIcon(undefined)}, 1000)
    return (
      <div className='like'>
        <EmotionIcon />
      </div>
    )
  }

  return <></>
}
