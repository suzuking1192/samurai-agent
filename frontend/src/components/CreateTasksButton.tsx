import React from 'react'

interface CreateTasksButtonProps {
  onClick: () => void
  disabled?: boolean
}

const CreateTasksButton: React.FC<CreateTasksButtonProps> = ({ onClick, disabled = false }) => {
  return (
    <div className="mt-4 mb-2">
      <button
        onClick={onClick}
        disabled={disabled}
        className={`
          create-tasks-btn
          group relative inline-flex items-center justify-center
          px-6 py-3 text-sm font-semibold text-white
          bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500
          hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600
          disabled:from-gray-400 disabled:via-gray-400 disabled:to-gray-400
          rounded-xl shadow-lg hover:shadow-xl
          transform hover:scale-105 active:scale-95
          transition-all duration-300 ease-out
          disabled:cursor-not-allowed disabled:transform-none
          border-0 outline-none focus:ring-4 focus:ring-purple-300 focus:ring-opacity-50
          backdrop-blur-sm
        `}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: '180px',
          minHeight: '32px',
          width: 'auto',
          height: 'auto'
        }}
      >
        {/* Animated background effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {/* Text */}
        <span className="relative z-10">
          Create tasks based on discussion so far
        </span>
        
        {/* Loading state */}
        {disabled && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-400/80 rounded-xl">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </button>
      

    </div>
  )
}

export default CreateTasksButton
