import { UserCircleIcon } from '@heroicons/react/24/solid';
import { MediaRenderer, useContract, useListing, useAddress, useBuyNow, useMakeOffer, useOffers, useMakeBid, useNetworkMismatch, useNetwork, useAcceptDirectListingOffer } from '@thirdweb-dev/react';
import { ListingType, NATIVE_TOKENS } from '@thirdweb-dev/sdk';
import { useRouter } from 'next/router'
import React, { useEffect, useState } from 'react'
import Header from '../../components/Header';
import Countdown from 'react-countdown';
import network from '../../utils/network';
import { ethers } from 'ethers';


const Listing = () => {
    const router = useRouter();
    const { listingId } = router.query as {listingId:string};

    const address = useAddress();

    const {contract} = useContract(process.env.NEXT_PUBLIC_MARKETPLACE_CONTRACT,'marketplace');
    const {data:listing, isLoading, error} = useListing(contract, listingId);
    
    const [minimumNextBid, setMinimumNextBid] = useState<{
        displayValue:string,
        symbol:string
    }>()
    const[bidAmount, setBidAmount] = useState('');

    const[, switchNetwork] = useNetwork();
    const networkMismatch = useNetworkMismatch();

    const { mutate: buyNow } = useBuyNow(contract)
    const { mutate: makeOffer } = useMakeOffer(contract);
    const { data: offers } = useOffers(contract, listingId);
    const { mutate: makeBid } = useMakeBid(contract)
    const { mutate: acceptOffer } = useAcceptDirectListingOffer(contract);

    useEffect(() => {
        if(!listing || !contract || !listingId) return

        if(listing.type === ListingType.Auction){
            fetchMinNextBid();
        }
    },[listing, contract, listingId]);

    const fetchMinNextBid = async() => {
        if(!listingId || !contract ) return;

        const minBidResponse = await contract.auction.getMinimumNextBid(listingId)
        setMinimumNextBid({
            displayValue: minBidResponse.displayValue,
            symbol: minBidResponse.symbol
        })
    }


    if (isLoading) {
        return( <div>
            <Header />
            <div className='text-center animate-pulse text-blue-500'>
                <p>Loading Item...</p>
            </div>
        </div>)
    }

    if(!listing){
        return <div>Listing not found</div>
    }

    const formatPlaceholder = () => {
        if(!listing) return

        if(listing.type === ListingType.Direct){
            return "Enter Offer Amount"
        }

        if(listing.type === ListingType.Auction){
            return Number(minimumNextBid?.displayValue) === 0 ? "Enter Bid Amount" : `${minimumNextBid?.displayValue} ${minimumNextBid?.symbol} or more`
        }
    }

    const buyNft = async() => { 

        if(networkMismatch){
            switchNetwork && switchNetwork(network);
            return
        }

        if(!listingId || !contract || !listing) return;

        await buyNow({
            id: listingId,
            buyAmount: 1,
            type: listing.type,
        },{
            onSuccess(data, variables, context) {
                alert("NFT bought successfully");
                router.replace("/")
            },
            onError(error, variables, context) {
                alert("ERROR: NFT could not bought");
                console.log("ERROR", error, variables, context);
            },
        })

    }

    const createBidOrOffer = async() => {
        try {
            if(networkMismatch){
                switchNetwork && switchNetwork(network);
                return;
            }
            
            //? Direct_Listing
            if(listing?.type === ListingType.Direct){
                if(listing.buyoutPrice.toString() === ethers.utils.parseEther(bidAmount).toString()){
                    console.log("Buyout Price met, buying NFT...");

                    buyNft();
                    return;
                }

                console.log("Buyout Price not met, making offer...");
                await makeOffer({
                    quantity: 1,
                    listingId,
                    pricePerToken: bidAmount,
                }, {
                    onSuccess(data, variables, context) {
                        alert("NFT bought successfully");
                        console.log("SUCCESS", data);
                        setBidAmount("")
                    },
                    onError(error, variables, context) {
                        alert("ERROR: NFT could not bought");
                        console.log("ERROR", error, variables, context);
                    }
                })
            }

            //? Auction_Listing
            if(listing?.type === ListingType.Auction){
                
                await makeBid({
                    listingId,
                    bid: bidAmount
                }, {
                    onSuccess(data, variables, context) {
                        alert("Bid made successfully");
                        console.log("SUCCESS", data);
                        setBidAmount("")
                    },
                    onError(error, variables, context) {
                        alert("ERROR: Bid could not be made");
                        console.log("ERROR", error, variables, context);
                    }
                })
            }

        } catch (error) {
            console.log(error)
        }
    }
    
    return (
    <div>
        <Header />
        
        <main className='max-w-6xl mx-auto p-2 flex flex-col lg:flex-row space-y-10 space-x-5 pr-10'>
            <div className='p-10 border mx-auto lg:mx-0 max-w-md lg:mx-w-xl'>
                <MediaRenderer src={listing.asset.image}/>
            </div>

            <section className='flex-1 space-y-5 pb-20 lg:pb-0'>
                <div>
                    <h1 className='text-xl font-bold'>
                        {listing.asset.name}
                    </h1>
                    <p className='text-gray-600'>
                        {listing.asset.description}
                    </p>
                    <p className='flex items-start text-xs sm:text-base'>
                        <UserCircleIcon className='h-5 mt-1'/>
                        <span className='font-bold pr-2 pl-1'>Seller: </span>{listing.sellerAddress}
                    </p>
                </div>

                <div className='grid grid-cols-2 items-center py-2'>
                    <p className='font-bold'>Listing Type:</p>
                    <p>
                        {listing.type === ListingType.Direct ? "Direct Listing" : "Auction Listing"}
                    </p>

                    <p className='font-bold'>Buy it Now Price:</p>
                    <p className='text-4xl font-bold'>{listing.buyoutCurrencyValuePerToken.displayValue} {listing.buyoutCurrencyValuePerToken.symbol}</p>
                
                    <button onClick={buyNft} className='col-start-2 mt-2 bg-blue-600 font-bold text-white rounded-full w-44 py-4 px-10'>Buy Now</button>
                </div>

                {listing.type === ListingType.Direct && offers && (
                    <div className='grid grid-cols-2 gap-y-2'>
                        <p className='font-bold'>Offers: </p>
                        <p className='font-bold'>{offers.length > 0 ? offers.length : 0}</p>
                    
                      {offers.map((offer) => {
                        <>
                          <p className='flex items-center ml-5 text-sm italic'>
                            <UserCircleIcon className='h-3 mr-2'/>
                            {offer.offeror.slice(0, 5) + 
                            "..." +
                            offer.offeror.slice(-5)}
                          </p>
                          <div>
                            <p key={offer.listingId + offer.offeror + offer.totalOfferAmount.toString()} className='text-sm italic'>
                                {ethers.utils.formatEther(offer.totalOfferAmount)}
                                {NATIVE_TOKENS[network].symbol}
                            </p>

                            {listing.sellerAddress === address && (
                                <button 
                                onClick={() => {
                                    acceptOffer({
                                    listingId,
                                    addressOfOfferor: offer.offeror
                                }, {
                                    onSuccess(data, variables, context) {
                                        alert("Offer accepted successfully");
                                        console.log("SUCCESS", data);
                                        router.replace("/")
                                    },
                                    onError(error, variables, context) {
                                        alert("ERROR: Offer could not be accepted");
                                        console.log("ERROR: ", error);
                                    },
                                })
                            }}
                                className="p-2 w-32 bg-red-500/50 rounded-lg font-bold text-xs cursor-pointer"
                                >
                                    Accept Offer
                                </button>
                            )}
                          </div>
                        </>
                       })}
                    </div>
                )}

                <div className='grid grid-cols-2 space-y-2 items-start justify-end'>
                    <hr className='col-span-2'/>

                    <p className='col-span-2 font-bold'>
                        {listing.type === ListingType.Direct ? "Make an Offer" : "Bid on this Auction"}
                    </p>

                    {/*TODO: Remaining time on auction goes here...*/}

                    {listing.type === ListingType.Auction && (
                        <>
                            <p>Current Minimum Bid</p>
                            <p className='font-bold'>
                                {minimumNextBid?.displayValue} {minimumNextBid?.symbol}
                            </p>
                            <p>Time Remaining</p>
                            <Countdown date={Number (listing.endTimeInEpochSeconds.toString()) * 1000} />
                        </>
                    )}

                    <input onChange={e => setBidAmount(e.target.value)} className='border p-2 py-4 rounded-lg mr-5 outline-blue-300' type='text' placeholder={formatPlaceholder()} />
                    <button onClick={createBidOrOffer} className='bg-red-600 font-bold text-white rounded-full w-44 py-4 px-10 mb-44'>
                        {listing.type === ListingType.Direct ? "Offer" : "Bid"}
                    </button>
                </div>
            </section>
        </main>
    </div>
  )
}

export default Listing
