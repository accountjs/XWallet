import cn from 'classnames';
import { useCallback, useContext, useEffect, useState } from 'react';
import qbrady_manga from 'data-base64:~popup/assets/svg/qbrady_manga.png';
import { useNavigate } from 'react-router-dom';
import { XWalletProviderContext } from '~popup/context';
import { it } from 'node:test';
import nft1 from 'data-base64:~popup/assets/svg/nft1.jpg';
import nft2 from 'data-base64:~popup/assets/svg/nft2.jpg';
import nft3 from 'data-base64:~popup/assets/svg/nft3.jpg';
import nft4 from 'data-base64:~popup/assets/svg/nft4.jpg';

interface NFTItem {
  tokenId: bigint;
  tokenURI: string;
  tokenName: string;
  tokenImage: string;
}

function NFTsBox() {
  const [tokensList, setTokenList] = useState<NFTItem[]>([]);
  const { mintNft, getNfts, userInfo } = useContext(XWalletProviderContext);
  const navigate = useNavigate();

  const toSendNFT = useCallback((item: NFTItem) => {
    navigate(`/sendNFT?tokenId=${item.tokenId}&tokenImage=${item.tokenImage}`);
  }, []);

  useEffect(() => {
    const nfts = [nft1, nft2, nft3, nft4];
    (async () => {
      // let { tokenids, tokenURIs } = await getNfts();
      let nftList: any = [];
      for (let i = 0; i < 4; i++) {
        nftList.push({
          tokenId: i,
          tokenName: `NFT #${i}`,
          tokenImage: nfts[i],
        });
      }
      setTokenList(nftList);
    })();
  }, []);

  return (
    <div
      className={cn(
        'px-5 py-4 h-[170px] rounded-b-2xl',
        'bg-[#E9E9E9] text-center relative',
        'overflow-y-hidden overflow-x-scroll'
      )}
    >
      {tokensList.length === 0 ? (
        <div
          className={cn(
            'absolute bottom-2 left-4',
            'text-sm font-semibold cursor-pointer',
            'flex justify-center items-center',
            'h-10 w-[320px] px-6 py-2 mb-3 rounded-2xl bg-white opacity-30'
          )}
          onClick={async () => {
            await mintNft(userInfo?.username);
          }}
        >
          + Import NFTs
        </div>
      ) : (
        <div className={cn('flex justify-start pr-5')}>
          {tokensList.map((i, index) => (
            <div
              onClick={() => toSendNFT(i)}
              key={index}
              className={cn(
                'flex justify-start items-center flex-shrink-0 flex-col cursor-pointer',
                'h-[135px] w-[105px] rounded-3xl bg-[#D9D9D9] overflow-hidden mr-5'
              )}
            >
              <img
                src={i.tokenImage}
                className="w-[105px] h-[105px] rounded-3xl"
              />
              <span className="font-semibold"> → </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default NFTsBox;
