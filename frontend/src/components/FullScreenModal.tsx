import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'

interface FullScreenModalProps {
  children: React.ReactNode
  isOpen: boolean
  onClose: () => void
}

// Ensure modal root exists
const getModalRoot = () => {
  let modalRoot = document.getElementById('modal-root')
  if (!modalRoot) {
    modalRoot = document.createElement('div')
    modalRoot.id = 'modal-root'
    modalRoot.style.position = 'relative'
    modalRoot.style.zIndex = '9999'
    document.body.appendChild(modalRoot)
  }
  return modalRoot
}

const FullScreenModal: React.FC<FullScreenModalProps> = ({ children, isOpen, onClose }) => {
  useEffect(() => {
    if (isOpen) {
      // Prevent background scrolling
      document.body.style.overflow = 'hidden'
      
      // Handle escape key
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose()
      }
      document.addEventListener('keydown', handleEscape)
      
      return () => {
        document.body.style.overflow = 'unset'
        document.removeEventListener('keydown', handleEscape)
      }
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div className="fullscreen-modal-overlay" onClick={onClose}>
      <div className="fullscreen-modal-content" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    getModalRoot()
  )
}

export default FullScreenModal 