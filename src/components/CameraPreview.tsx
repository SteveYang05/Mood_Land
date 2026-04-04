import { forwardRef } from 'react'

type Props = {
  active: boolean
  className?: string
}

/** active 为 false 时仍挂载，便于 ref 接流；此时隐藏不占版面 */
const CameraPreview = forwardRef<HTMLVideoElement, Props>(function CameraPreview(
  { active, className = '' },
  ref,
) {
  return (
    <video
      ref={ref}
      className={`camera-feed ${active ? '' : 'camera-feed--hidden'} ${className}`.trim()}
      muted
      playsInline
      autoPlay
    />
  )
})

export default CameraPreview
