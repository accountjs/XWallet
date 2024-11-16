import cn from 'classnames';
import success from 'data-base64:~popup/assets/svg/success.svg';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { Button } from '~components/ui/button';

function SendToken(props: {}) {
  const navigate = useNavigate();

  const handleCopyAddress = useCallback(() => {
    console.log('copied');
  }, []);

  return (
    <div className="p-4 relative pb-6 h-[100%] border border-[#ECECEC] rounded-2xl">
      <img src={success} alt="" style={{ display: 'block', margin: '20px auto' }} />
      <div className="flex items-center justify-center" >
        <p>hash: 0x4ab1...382b</p>
        <div className="cursor-pointer" style={{ marginLeft: '8px' }}>
          <CopyToClipboard
            text={'0x4ab1e1fb4f03cd0451b22024d9e772ad33be6baf354f07a643c83b7da5ba382b'}
            onCopy={handleCopyAddress}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="15"
              viewBox="0 0 12 15"
              fill="none"
            >
              <rect
                x="0.5"
                y="0.5"
                width="8"
                height="11"
                fill="#F7F7F7"
                stroke="#DCDCDC"
              />
              <rect
                x="3.5"
                y="3.5"
                width="8"
                height="11"
                fill="#F7F7F7"
                stroke="#DCDCDC"
              />
            </svg>
          </CopyToClipboard>
        </div>
      </div>
      <p style={{textAlign: 'center', margin: '20px auto', fontSize: '16px', color: '#989898'}}>Push notification→</p>
      <Button style={{width: '100%', background: '#1D9BF0', color: '#fff', marginTop: '30px', borderRadius: '50px'}} onClick={() => navigate('/')}>
        Confirmed
      </Button>
    </div>

  );
}

export default SendToken;
