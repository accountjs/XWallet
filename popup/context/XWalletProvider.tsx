import { useStorage } from '@plasmohq/storage/hook';
import { SecureStorage } from '@plasmohq/storage/secure';
import { WALLET_ADAPTERS } from '@web3auth/base';
import { EthereumPrivateKeyProvider } from '@web3auth/ethereum-provider';
import { Web3AuthNoModal } from '@web3auth/no-modal';
import { OpenloginAdapter } from '@web3auth/openlogin-adapter';
import { ECDSAProvider, ERC20Abi, getRPCProviderOwner } from '@zerodev/sdk';
import { createBicoPaymasterClient, createNexusClient, NexusClient } from "@biconomy/sdk"; 

import { Contract, JsonRpcProvider, id } from 'ethers';
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

const bundlerUrl = "https://bundler.biconomy.io/api/v3/84532/nJPK7B3ru.dd7f7861-190d-41bd-af80-6877f74b8f44";
const paymasterUrl = "https://paymaster.biconomy.io/api/v2/84532/F7wyL1clz.75a64804-3e97-41fa-ba1e-33e98c2cc703"; 
 

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
  chainId: '0x14a34', // hex of 80001, polygon testnet
  rpcTarget: 'https://rpc.ankr.com/base_sepolia',
  displayName: 'Base Sepolia Testnet',
  blockExplorer: 'https://sepolia.basescan.org',
  ticker: 'ETH',
  tickerName: 'PA public testnet for Base.',
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
  // const [ecdsaProvider, setEcdsaProvider] = useState<ECDSAProvider | null>(null);
  const [nexusClient, setNexusClient] = useState<NexusClient | null>(null);
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

  useEffect(() => {
    if (!loginLoading && web3auth && web3auth.connected) {
      setIsLogin(true);
      (async () => {
        const userinfo = await web3auth.getUserInfo();
        let twitterId = userinfo.verifierId.match(/(\d+)/)[0];
        let twitterInfo = await getXWalletAddressById(twitterId);

        // console.log(userinfo, twitterInfo);
        let twitterName = twitterInfo?.user_info?.name ?? '';
        let username = twitterInfo?.user_info?.username ?? '';
        setUserInfo({
          username,
          twitterId,
          twitterName,
          ownerAddress: twitterInfo?.owner_address ?? '0x',
          accountAddress: twitterInfo?.account_address ?? '0x',
        });
        let accountAddress = twitterInfo?.account_address ?? '';
        let ownerAddress = await getRPCProviderOwner(
          web3auth.provider
        ).getAddress();
        updateBalance();
        // await getETHBalance(twitterInfo?.account_address ?? '0x');
        // await getUsdtBalance(twitterInfo?.account_address ?? '0x');
        try {
          const resp = await deployXWallet(ownerAddress, twitterId);
          console.log('deploy', resp);
        } catch (e) {
          console.log(e);
        }
        // const ecdsaProvider = await ECDSAProvider.init({
        //   projectId: DEFAULT_PROJECT_ID,
        //   owner: getRPCProviderOwner(web3auth.provider),
        //   opts: {
        //     accountConfig: {
        //       accountAddress,
        //     },
        //   },
        // });
        // setEcdsaProvider(ecdsaProvider);
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
      // const { hash } = await ecdsaProvider.sendUserOperation({
      //   target: NFT_ADDRESS,
      //   data: encodeFunctionData({
      //     abi: parseAbi(['function mint(address to, string calldata handle)']),
      //     functionName: 'mint',
      //     args: [userInfo.accountAddress, twitterHandle],
      //   }),
      // });

      const hash = await nexusClient.sendTransaction({ calls:  
        [{to : NFT_ADDRESS, value: parseEther('0')}, {
          data: encodeFunctionData({
            abi: parseAbi(['function mint(address to, string calldata handle)']),
            functionName: 'mint',
            args: [userInfo.accountAddress, twitterHandle],
          }),
        }],
      });
      console.log('Mint to', userInfo.accountAddress, 'hash', hash);
      await nexusClient.waitForTransactionReceipt(hash);
      return hash;
    },
    [nexusClient]
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
  }, [nexusClient]);

  const getTransaction = useCallback(
    async (hash: `0x${string}`) => {
      return nexusClient.getTransaction(hash);
    },
    [nexusClient]
  );

  const getUserOperationByHash = useCallback(
    async (hash: `0x${string}`) => {
      return nexusClient.getUserOperationByHash(hash);
    },
    [nexusClient]
  );

  const sendETH = useCallback(
    async (toAddress: `0x${string}`, value: string) => {
      setIsSendLogin(true);
      let return_hash;
      try {
        const { hash } = await nexusClient.sendTransaction({
          target: toAddress,
          data: '0x',
          value: parseEther(value),
        });
        return_hash = hash;
        console.log('Send to', toAddress, 'ETH', value, 'hash', hash);
        await nexusClient.waitForTransactionReceipt(hash);
      } finally {
        setIsSendLogin(false);
      }
      return return_hash;
    },
    [nexusClient]
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
        const { hash } = await nexusClient.sendTransaction({
          target: tokenAddress,
          data: encodeFunctionData({
            abi: ERC20Abi,
            functionName: 'transfer',
            args: [toAddress, parseUnits(value, dec)],
          }),
        });
        return_hash = hash;
        console.log('Send to', toAddress, 'ETH', value, 'hash', hash);
        await nexusClient.waitForTransactionReceipt(hash);
        console.log('Send to', toAddress, 'Value', value, 'hash', hash);
      } finally {
        setIsSendLogin(false);
      }
      return return_hash;
    },
    [nexusClient]
  );
  const sendNFT = useCallback(
    async (
      tokenAddress: `0x${string}`,
      toAddress: `0x${string}`,
      tokenId: string
    ) => {
      console.log(tokenId);
      const { hash } = await nexusClient.sendTransaction({
        target: tokenAddress,
        data: encodeFunctionData({
          abi: NFT_TRANSFER_FUNC_ABI,
          functionName: 'safeTransferFrom',
          args: [userInfo.accountAddress, toAddress, BigInt(tokenId)],
        }),
      });

      await nexusClient.waitForTransactionReceipt(hash);
      console.log(`Send NFT ${tokenId} to`, toAddress, 'hash', hash);
      return hash;
    },
    [nexusClient]
  );

  const checkTarget = async (target: string) => {
    const isEthereumAddress = /^0x[0-9a-fA-F]{40}$/.test(target);
    if (isEthereumAddress) {
      return target;
    } else {
      const repo = await getXWalletAddress(target);
      return repo['account_address'];
    }
  };

  const getXWalletAddress = async (handle: string) => {
    const requestBody = JSON.stringify({
      handle,
    });
    const response = await fetch(
      'https://x-wallet-backend.vercel.app/api/getAddress',
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

  const getETHBalance = async (address: `0x${string}`) => {
    if (address === '0x') {
      return '0';
    }
    const balance = formatEther(
      await publicClient.getBalance({
        address: address,
      })
    );
    setEthBalance(balance);
    return balance;
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
    const ethBalance = await getETHBalance(userInfo.accountAddress);
    const usdtBalance = await getUsdtBalance(userInfo.accountAddress);
    setEthBalance(ethBalance);
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
