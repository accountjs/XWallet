import { useStorage } from '@plasmohq/storage/hook';
import { SecureStorage } from '@plasmohq/storage/secure';
import { WALLET_ADAPTERS } from '@web3auth/base';
import { EthereumPrivateKeyProvider } from '@web3auth/ethereum-provider';
import { Web3AuthNoModal } from '@web3auth/no-modal';
import { OpenloginAdapter } from '@web3auth/openlogin-adapter';
import { ECDSAProvider, ERC20Abi, getRPCProviderOwner } from '@zerodev/sdk';
// import { createBicoPaymasterClient, createNexusClient } from "@biconomy/sdk"; 

import { Contract, JsonRpcProvider, BrowserProvider } from 'ethers';
import { send } from 'node:process';
import { createContext, useCallback, useEffect, useState } from 'react';
import {
  createPublicClient,
  encodeFunctionData,
  formatEther,
  http,
  parseAbi,
  parseEther,
  parseUnits,
} from 'viem';
import { polygonMumbai } from 'viem/chains';
import { NFT_Contract_Abi } from '~contractAbi.js';

export const publicClient = createPublicClient({
  chain: polygonMumbai,
  transport: http(),
});

export const XWalletProviderContext = createContext(undefined);
const DEFAULT_PROJECT_ID = 'c1148dbd-a7a2-44b1-be79-62a54c552287';
const NFT_CONTRACT_ABI = NFT_Contract_Abi;
export const NFT_ADDRESS = '0xe632e9460810283e29911c306fd608fec8e9eaa2';
const TRANSFER_FUNC_ABI = parseAbi([
  'function transfer(address recipient, uint256 amount) public',
]); // TODO: token ABI
const NFT_TRANSFER_FUNC_ABI = parseAbi([
  'function safeTransferFrom( address from, address to, uint tokenId)',
]);
const storage = new SecureStorage();
storage.setPassword('Xwallet');

export interface UserInfo {
  username: string;
  twitterId: string;
  twitterName: string;
  ownerAddress: `0x${string}`;
  accountAddress: `0x${string}`;
}

export interface TxRecord {
  timestamp: string;
  toTwitter: string;
  toAddress: `0x${string}`;
  amount: string;
  currency: string;
  hash: string;
}

const polygonConfig = {
  chainNamespace: 'eip155',
  chainId: '0x13882', // hex of 80001, polygon testnet
  rpcTarget: 'https://rpc.ankr.com/polygon_amoy',
  displayName: 'Polygon Amoy Testnet',
  blockExplorer: 'https://amoy.polygonscan.com/',
  ticker: 'POL',
  tickerName: 'Polygon Ecosystem Token',
};

const baseConfig = {
  chainNamespace: 'eip155',
  chainId: '0x85', // hex of 80001, polygon testnet
  rpcTarget: 'https://hashkeychain-testnet.alt.technology',
  displayName: 'HashKey Chain Testnet',
  blockExplorer: 'https://hashkeychain-testnet-explorer.alt.technology',
  ticker: 'HSK',
  tickerName: 'HashKey Chain Testnet',
};

const chainConfig = baseConfig;

export function XWalletProvider({ children }) {
  const [isLogin, setIsLogin] = useState(false);
  const [isSendLogin, setIsSendLogin] = useState(false);
  const [ethBalance, setEthBalance] = useState('0');
  const [usdtBalance, setUsdtBalance] = useState('0');
  const [loginLoading, setLoginLoading] = useState(false);
  const [userInfo, setUserInfo] = useStorage<UserInfo>('user-info');
  const [txRecords, setTxRecords] = useStorage<TxRecord[]>('tx-history', []);
  const [ecdsaProvider, setEcdsaProvider] = useState<ECDSAProvider | null>(
    null
  );
  const [web3auth, setWeb3auth] = useState<Web3AuthNoModal | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const web3auth = new Web3AuthNoModal({
          clientId:
            'BI0ucyGDGEjuT7yJq5xe_fZBT825nYnZ70Ky-D11Y3AdijGZzkx6XY1Vwv1zjC_cOYgrKCe3cN9GD28m7yC0bG8',
          web3AuthNetwork: 'sapphire_devnet',
          // @ts-ignore
          chainConfig,
        });
        const privateKeyProvider = new EthereumPrivateKeyProvider({
          config: { chainConfig },
        });

        const openloginAdapter = new OpenloginAdapter({
          privateKeyProvider,
        });
        web3auth.configureAdapter(openloginAdapter);
        await web3auth.init();
        setWeb3auth(web3auth);
      } catch (e) {
        console.error(e);
      }
    };
    init();
  }, []);

  const sendETHFn =  async (toAddress: string) => {
    const requestBody = JSON.stringify({
      address: toAddress,
      network: 'hsk',
    });
    const response = await fetch(
      'https://test-vercel-henna-psi.vercel.app/api/send',
      {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: requestBody,
      }
    );
    // console.log('response', await response.json());
    return await response.json();
  }

  useEffect(() => {
    if (!loginLoading && web3auth && web3auth.connected) {
      setIsLogin(true);
      (async () => {
        const userinfo = await web3auth.getUserInfo();
        console.log(userinfo);
        const twitterId = userinfo.email;
        // console.log(userinfo, twitterInfo);
        const twitterName = userinfo.name;
        const username = userinfo.name;
        console.log('twitterId', web3auth.provider);
        const ownerAddress = await getRPCProviderOwner(
          web3auth.provider
        ).getAddress();
        // await sendETHFn(ownerAddress);
        const accountAddress = await checkTarget(twitterId);
        console.log('address', accountAddress);
        setUserInfo({
          username,
          twitterId,
          twitterName,
          ownerAddress,
          accountAddress: accountAddress,
        });
        
        await updateBalance();
        // await getETHBalance(twitterInfo?.account_address ?? '0x');
        // await getUsdtBalance(twitterInfo?.account_address ?? '0x');
        const ecdsaProvider = await ECDSAProvider.init({
          projectId: DEFAULT_PROJECT_ID,
          owner: getRPCProviderOwner(web3auth.provider),
          opts: {
            accountConfig: {
              accountAddress,
            },
          },
        });
        setEcdsaProvider(ecdsaProvider);
      })();
    }
  }, [web3auth, loginLoading]);

  const login = useCallback(async () => {
    if (!web3auth) {
      return;
    }
    setLoginLoading(true);

    try {
      await web3auth.connectTo(WALLET_ADAPTERS.OPENLOGIN, {
        loginProvider: 'twitter',
      });
    } catch (e) {
      // console.log(e);
    } finally {
      setLoginLoading(false);
    }
  }, [web3auth]);

  const mintNft = useCallback(
    async (twitterHandle: string) => {
      const { hash } = await ecdsaProvider.sendUserOperation({
        target: NFT_ADDRESS,
        data: encodeFunctionData({
          abi: parseAbi(['function mint(address to, string calldata handle)']),
          functionName: 'mint',
          args: [userInfo.accountAddress, twitterHandle],
        }),
      });
      console.log('Mint to', userInfo.accountAddress, 'hash', hash);
      await ecdsaProvider.waitForUserOperationTransaction(
        hash as `0x${string}`
      );
      return hash;
    },
    [ecdsaProvider]
  );

  const getNfts = useCallback(async () => {
    const contract = new Contract(
      NFT_ADDRESS,
      [
        'function getTokens(address addr) public view returns (uint[] memory)',
        'function getTokensURI(address addr) public view returns (string[] memory)',
      ],
      new JsonRpcProvider(chainConfig.rpcTarget)
    );
    let tokenids = Object.values(
      await contract.getTokens(userInfo.accountAddress)
    );
    let tokenURIs = Object.values(
      await contract.getTokensURI(userInfo.accountAddress)
    );
    return { tokenids, tokenURIs };
  }, [ecdsaProvider]);

  const getTransaction = useCallback(
    async (hash: `0x${string}`) => {
      return ecdsaProvider.getTransaction(hash);
    },
    [ecdsaProvider]
  );

  const getUserOperationByHash = useCallback(
    async (hash: `0x${string}`) => {
      return ecdsaProvider.getUserOperationByHash(hash);
    },
    [ecdsaProvider]
  );

  const sendTransaction = async (toAddress, amount) => {
    const provider = web3auth.provider;
    try {
      const ethersProvider = new BrowserProvider(provider);
      const signer = await ethersProvider.getSigner();
      // Submit transaction to the blockchain
      const tx = await signer.sendTransaction({
        to: toAddress,
        value: parseEther(amount),
        maxPriorityFeePerGas: "5000000000", // Max priority fee per gas
        maxFeePerGas: "6000000000000", // Max fee per gas
      });
  
      // Wait for transaction to be mined
      const receipt = await tx.wait();
  
      return receipt;
    } catch (error) {
      return error;
    }
  }

  const sendETH = useCallback(
    async (toAddress: string, value: string) => {
      setIsSendLogin(true);
      let return_hash;
      try {
        const receipt = await sendTransaction(toAddress, value);
        console.log('Send to', toAddress, 'ETH', value, 'hash', receipt);
        return_hash = receipt.hash;
      } finally {
        setIsSendLogin(false);
      }
      return return_hash;
    },
    [ecdsaProvider]
  );

  const sendERC20 = useCallback(
    async (
      tokenAddress: `0x${string}`,
      toAddress: `0x${string}`,
      value: string,
      dec: number
    ) => {
      setIsSendLogin(true);
      let return_hash;
      try {
        const { hash } = await ecdsaProvider.sendUserOperation({
          target: tokenAddress,
          data: encodeFunctionData({
            abi: ERC20Abi,
            functionName: 'transfer',
            args: [toAddress, parseUnits(value, dec)],
          }),
        });
        return_hash = hash;
        console.log('Send to', toAddress, 'ETH', value, 'hash', hash);
        await ecdsaProvider.waitForUserOperationTransaction(
          hash as `0x${string}`
        );
        console.log('Send to', toAddress, 'Value', value, 'hash', hash);
      } finally {
        setIsSendLogin(false);
      }
      return return_hash;
    },
    [ecdsaProvider]
  );
  const sendNFT = useCallback(
    async (
      tokenAddress: `0x${string}`,
      toAddress: `0x${string}`,
      tokenId: string
    ) => {
      console.log(tokenId);
      const { hash } = await ecdsaProvider.sendUserOperation({
        target: tokenAddress,
        data: encodeFunctionData({
          abi: NFT_TRANSFER_FUNC_ABI,
          functionName: 'safeTransferFrom',
          args: [userInfo.accountAddress, toAddress, BigInt(tokenId)],
        }),
      });

      await ecdsaProvider.waitForUserOperationTransaction(
        hash as `0x${string}`
      );
      console.log(`Send NFT ${tokenId} to`, toAddress, 'hash', hash);
      return hash;
    },
    [ecdsaProvider]
  );

  const checkTarget = async (target: string) => {
      const repo = await getXWalletAddress(target);
      return repo['predictedAddress'];
  };

  const getXWalletAddress = async (handle: string) => {
    const response = await fetch(
      `https://test-vercel-henna-psi.vercel.app/api/predict_address?network=hsk&twitterId=${handle}`,
    );
    return await response.json();
  };

  const getXWalletAddressById = async (id: string) => {
    const requestBody = JSON.stringify({
      id,
    });
    const response = await fetch(
      'https://x-wallet-backend.vercel.app/api/getAddressById',
      {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: requestBody,
      }
    );
    return await response.json();
  };

  const deployXWallet = async (newOwner: `0x${string}`, id: string) => {
    const requestBody = JSON.stringify({
      newOwner: newOwner,
      id: id,
    });
    const response = await fetch(
      'https://x-wallet-backend.vercel.app/api/deploy',
      {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: requestBody,
      }
    );
    return await response.json();
  };


  const getETHBalance = async () => {
    const provider = web3auth.provider;
    if (!provider) {
      return;
    }
    try {
      const ethersProvider = new BrowserProvider(provider);
      const signer = await ethersProvider.getSigner();
  
      // Get user's Ethereum public address
      const address = signer.getAddress();
      console.log('address', address);
      // Get user's balance in ether
      const balance = formatEther(
        await ethersProvider.getBalance(address) // Balance is in wei
      );

      console.log('balance', balance);
  
      return balance;
    } catch (error) {
      return error;
    }
  };

  const getUsdtBalance = async (address: `0x${string}`) => {
    if (address === '0x') {
      return '0';
    }
    const balance = formatEther(
      await publicClient.readContract({
        address: '0x4aAeB0c6523e7aa5Adc77EAD9b031ccdEA9cB1c3',
        abi: ERC20Abi,
        functionName: 'balanceOf',
        args: [address],
      })
    );
    // setUsdtBalance(balance);
    return balance;
  };

  // 更新余额
  const updateBalance = useCallback(async () => {
    const balance = await getETHBalance(); 
    if (balance == 0 && userInfo.ownerAddress) {
      await sendETHFn(userInfo.ownerAddress);
      updateBalance();
    }
    console.log('ethBalance', balance);
    setEthBalance(balance);
    const usdtBalance = await getUsdtBalance(userInfo.accountAddress);
    console.log('ethBalance', balance, 'usdtBalance', usdtBalance);
    setEthBalance(balance);
    setUsdtBalance(usdtBalance);
  }, [userInfo, ecdsaProvider]); 

  // 插入交易记录
  const appendRecord = (txRecord: TxRecord) => {
    if (!txRecords) {
      setTxRecords([txRecord]);
    } else {
      setTxRecords([...txRecords, txRecord]);
    }
  };

  return (
    <XWalletProviderContext.Provider
      value={{
        userInfo,
        isLogin,
        login,
        loginLoading,
        mintNft,
        sendETH,
        sendERC20,
        sendNFT,
        getNfts,
        ethBalance,
        usdtBalance,
        getETHBalance,
        getUsdtBalance,
        updateBalance,
        getXWalletAddress,
        txRecords,
        appendRecord,
        getTransaction,
        getUserOperationByHash,
        isSendLogin,
      }}
    >
      {children}
    </XWalletProviderContext.Provider>
  );
}
