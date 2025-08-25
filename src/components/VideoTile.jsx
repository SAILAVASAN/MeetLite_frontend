export default function VideoTile({ stream, name, isSelf=false }) {
    return (
    <div className={`video-tile ${isSelf ? 'self' : ''}`}>
    <video
    ref={(el) => { if (el && stream) { el.srcObject = stream; el.onloadedmetadata = () => el.play(); } }}
    playsInline
    autoPlay
    muted={isSelf}
    />
    <div className="badge">{name}</div>
    </div>
    );
    }