import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';

// Premium gradients for cards
export const cardColors = [
  { id: 'blue', background: 'linear-gradient(135deg, #0A2342 0%, #1756A9 100%)' },
  { id: 'purple', background: 'linear-gradient(135deg, #420A40 0%, #9017A9 100%)' },
  { id: 'emerald', background: 'linear-gradient(135deg, #0A4222 0%, #17A956 100%)' },
  { id: 'gold', background: 'linear-gradient(135deg, #42350A 0%, #A98C17 100%)' },
  { id: 'obsidian', background: 'linear-gradient(135deg, #111 0%, #333 100%)' },
  { id: 'ruby', background: 'linear-gradient(135deg, #420A0A 0%, #A91717 100%)' },
];

function AccountCard({ 
  account, 
  index, 
  totalCards, 
  onSwipe, 
  onClick,
  onHold 
}) {
  const x = useMotionValue(0);
  const scale = useTransform(x, [-150, 0, 150], [0.9, 1, 0.9]);
  const rotateZ = useTransform(x, [-150, 0, 150], [-8, 0, 8]);
  const opacity = useTransform(x, [-200, 0, 200], [0, 1, 0]);

  const holdTimeout = useRef(null);
  const [isPressing, setIsPressing] = useState(false);

  const isFront = index === 0;
  const zIndex = totalCards - index;
  const yOffset = index * 15; 
  const scaleOffset = 1 - (index * 0.04);

  const handleDragEnd = (e, { offset }) => {
    const swipe = offset.x;
    if (swipe > 100 || swipe < -100) {
      onSwipe(account.id);
    }
  };

  const handlePointerDown = () => {
    if (!isFront) return;
    setIsPressing(true);
    holdTimeout.current = setTimeout(() => {
      onHold(account);
      setIsPressing(false);
    }, 500);
  };

  const handlePointerUp = () => {
    setIsPressing(false);
    if (holdTimeout.current) {
      clearTimeout(holdTimeout.current);
    }
  };

  const handleClick = () => {
    if (!isFront) {
      onSwipe(account.id);
    } else {
      onClick(account);
    }
  };

  const colorObj = cardColors.find(c => c.id === account.color) || cardColors[0];
  
  const typeStr = account.type || '';
  const nameStr = account.name || '';
  const showTypeLabel = !nameStr.toLowerCase().includes(typeStr.toLowerCase());

  return (
    <motion.div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        x: isFront ? x : 0,
        y: yOffset,
        scale: isFront ? scale : scaleOffset,
        rotateZ: isFront ? rotateZ : (index % 2 === 0 ? 1 : -1), // Slight messy stack effect
        opacity: opacity,
        zIndex: zIndex,
        transformOrigin: 'bottom center',
      }}
      drag={isFront ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={handleClick}
      initial={{ scale: 0, y: 50, opacity: 0 }}
      animate={{ scale: isFront ? 1 : scaleOffset, y: yOffset, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      whileTap={isFront && !isPressing ? { scale: 0.98 } : {}}
      className={`account-card-container ${isPressing ? 'pressing' : ''}`}
    >
      <div 
        className="premium-card"
        style={{
          background: colorObj.background,
          padding: '24px',
          borderRadius: '20px',
          boxShadow: isFront ? '0 25px 50px -12px rgba(0,0,0,0.4), inset 0 1px 1px rgba(255,255,255,0.3)' : '0 10px 20px rgba(0,0,0,0.15)',
          color: 'white',
          width: '240px',   // VERTICAL ORIENTATION
          height: '380px',  // VERTICAL ORIENTATION
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          border: '1px solid rgba(255,255,255,0.15)'
        }}
      >
        <div className={`card-texture texture-${account.type.toLowerCase().replace(' ', '-')}`} />
        
        {/* Top Section: Chip & Name */}
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {account.type === 'Bank' || account.type === 'Credit Card' ? (
              // Realistic vertical card chip
              <svg width="36" height="42" viewBox="0 0 36 42" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.9 }}>
                <rect width="36" height="42" rx="6" fill="#D4AF37"/>
                <path d="M0 12H12V30H0" stroke="#B8860B" strokeWidth="1.5"/>
                <path d="M36 12H24V30H36" stroke="#B8860B" strokeWidth="1.5"/>
                <path d="M12 18H24" stroke="#B8860B" strokeWidth="1.5"/>
                <path d="M12 24H24" stroke="#B8860B" strokeWidth="1.5"/>
                <rect x="12" y="12" width="12" height="18" rx="2" stroke="#B8860B" strokeWidth="1.5"/>
              </svg>
            ) : (
              <div style={{ width: '40px', height: '40px', background: 'rgba(255,255,255,0.15)', borderRadius: '50%', backdropFilter: 'blur(10px)' }} />
            )}
            
            {/* Contactless Icon */}
            {(account.type === 'Bank' || account.type === 'Credit Card') && (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.6 }}>
                <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z" fill="white"/>
              </svg>
            )}
          </div>

          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '600', margin: 0, letterSpacing: '0.5px', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>{account.name}</h3>
            {showTypeLabel && (
              <p style={{ fontSize: '0.75rem', opacity: 0.8, margin: '2px 0 0 0', textTransform: 'uppercase', letterSpacing: '1px' }}>
                {account.type}
              </p>
            )}
          </div>
        </div>

        {/* Bottom Section: Digits & Balance */}
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {account.last4Digits && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', letterSpacing: '2px', fontFamily: 'monospace', opacity: 0.9 }}>
              <span style={{ fontSize: '1.4rem', transform: 'translateY(2px)' }}>••••</span> {account.last4Digits}
            </div>
          )}
          
          <div>
            <p style={{ fontSize: '0.75rem', opacity: 0.7, margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {account.type === 'Credit Card' ? 'Available Limit' : 'Balance'}
            </p>
            <h2 style={{ fontSize: '2.2rem', fontWeight: '700', margin: '2px 0 0 0', letterSpacing: '-1px', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
              ₹{account.type === 'Credit Card' 
                ? (Number(account.creditLimit || 0) - Number(account.balance || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })
                : Number(account.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </h2>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default AccountCard;
