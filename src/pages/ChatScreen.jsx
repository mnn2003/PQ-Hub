import React, { useContext, useEffect, useRef, useState } from 'react'
import userPhoto from '../assets/user.png'
import { Link, useParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faHistory, faPaperPlane, faImage } from '@fortawesome/free-solid-svg-icons'
import { arrayUnion, doc, getDoc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore'
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db } from '../firebase/firebaseService'
import { MyAppContext, useChatRoom } from '../AppContext/MyContext'
import { TimeAgo } from '../TimeAgo'
import { CircularProgress } from '@mui/material'
import moment from 'moment'

const ChatScreen = () => {
    const { chatId } = useParams();
    let [currentUser, receiver] = chatId.split('-');
    const [recieverData, setRecieverData] = useState(null);
    const [userData, setUserData] = useState(null);
    const { user } = useContext(MyAppContext);
    const [userInput, setUserInput] = useState('');
    const [prevMsgs, setprevMsgs] = useState([])
    const [loading, setLoading] = useState(true)
    const messageBodyRef = useRef(null);
    const bigCont = useRef(null);
    const [isScrolledManually, setIsScrolledManually] = useState(false);
    const inpCont = useRef(null);
    const [isSent, setIsSent] = useState(false);
    const { viewingChatRoom, setViewingChatRoom } = useChatRoom();
    const [imageFile, setImageFile] = useState(null)
    const fileInputRef = useRef(null)
    const [imagesLoaded, setImagesLoaded] = useState(0);

    if (user && currentUser === user?.uid) {
        receiver = receiver;
    } else {
        receiver = currentUser;
    }

    const handleImageUpload = (e) => {
        const file = e.target.files[0]
        if (file) {
            setImageFile(file)
        }
    }

    const HandleChange = (e) => {
        setUserInput(e.target.value)
    }

    const handleFocus = () => {
        inpCont.current.focus();
    }

    useEffect(()=>{
        document.title = 'Private Chat'
    },[document.title])

    const checkChatRoomExists = async (currentUser, visitedUser) => {
        const chatRoomId1 = `${currentUser}-${visitedUser}`;
        const chatRoomId2 = `${visitedUser}-${currentUser}`;

        // Check if the chat room exists using either of the IDs
        const chatRoom1 = await getDoc(doc(db, 'Chats', chatRoomId1));
        const chatRoom2 = await getDoc(doc(db, 'Chats', chatRoomId2));

        // Return the chat room ID if it exists, otherwise return null
        if (chatRoom1.exists()) {
            return chatRoomId1;
        } else if (chatRoom2.exists()) {
            return chatRoomId2;
        } else {
            return null;
        }
    };

    const uploadImage = async () => {
        if (!imageFile) return null
        const storage = getStorage()
        const imageRef = ref(storage, `chat_images/${Date.now()}_${imageFile.name}`)
        await uploadBytes(imageRef, imageFile)
        const downloadURL = await getDownloadURL(imageRef)
        return downloadURL
    }

    let send = async () => {
        let date = new Date();
        let hh = date.getHours();
        let mm = date.getMinutes();
        let ampm = hh >= 12 ? 'pm' : 'am';
        hh = hh % 12 || 12;
        hh = (hh < 10 ? '0' + hh : hh);
        mm = (mm < 10 ? '0' + mm : mm);
        let time = `${hh}:${mm} ${ampm}`;
    
        let imageUrl = null;
        if (imageFile) {
            imageUrl = await uploadImage();
        }
    
        const userMsg = {
            message: userInput,
            senderId: user.uid,
            receiverId: receiver,
            time,
            timestamp: Date.now(),
            date: new Date(),
            seen: false,
            imageUrl: imageUrl
        };
    
        setImageFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    
        setprevMsgs(prev => [...prev, userMsg]);
        setUserInput('');
    
        // Ensure the scroll happens after the new message is added
        setTimeout(() => {
            scrollToBottom();
        }, 100); // Slight delay to ensure the UI has updated
    
        try {
            if (!receiver || !user?.uid) return;
            let combinedIds = await checkChatRoomExists(user.uid, receiver);
            if (!combinedIds) {
                combinedIds = `${user.uid}-${receiver}`;
            }
    
            const chatsDoc = doc(db, 'Chats', combinedIds);
            const receiverDoc = doc(db, 'Users', receiver);
            const currentUserDoc = doc(db, 'Users', user.uid);
            const currentUserSnapshot = await getDoc(currentUserDoc);
            const chatSnapshot = await getDoc(chatsDoc);
    
            if (TimeAgo(currentUserSnapshot.data()?.lastseen) !== 'just now' || TimeAgo(currentUserSnapshot.data()?.lastseen) !== '1 minute ago') {
                await updateDoc(doc(db, 'Users', user?.uid), {
                    lastseen: Date.now()
                });
            }
    
            if (chatSnapshot.exists()) {
                await updateDoc(chatsDoc, {
                    messages: arrayUnion(userMsg),
                    senderId: user.uid,
                    receiverId: receiver,
                    timestamp: Date.now(),
                    chatRoomId: combinedIds,
                });
            } else {
                await setDoc(chatsDoc, {
                    messages: [userMsg],
                    senderId: user.uid,
                    receiverId: receiver,
                    timestamp: Date.now(),
                    chatRoomId: combinedIds
                });
    
                await Promise.all([
                    updateDoc(receiverDoc, { chatIds: arrayUnion(combinedIds) }),
                    updateDoc(currentUserDoc, { chatIds: arrayUnion(combinedIds) })
                ]);
            }
            setIsSent(true);
        } catch (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    };

    let sendMsg = () => {
        if ((userInput.trim() !== '' || imageFile) && !loading) {
            send();
        }
        return;
    }
    

    const updateMessageSeen = async (chatRoomId, messageTimestamp, seen) => {
        try {
            const chatDoc = doc(db, 'Chats', chatRoomId);
            const chatSnapshot = await getDoc(chatDoc);

            if (chatSnapshot.exists()) {
                const chatData = chatSnapshot.data();
                const messages = chatData.messages;
                const currentUserIsReceiver = chatData.receiverId === user.uid;
                // Find the message in the messages array and update 'seen' field
                messages.forEach(message => {
                    if (message.timestamp === messageTimestamp && currentUserIsReceiver) {
                        message.seen = seen;
                    }
                });

                // Update the 'messages' array in the database
                await updateDoc(chatDoc, { messages: messages });
            }
        } catch (error) {
            console.error('Error updating message seen status:', error);
        }
    };


    useEffect(() => {
        if (!receiver || !user || !user.uid) return;

        const fetchData = async () => {
            try {
                const [recieverSnapshot, currentUserSnapshot] = await Promise.all([
                    getDoc(doc(db, 'Users', receiver)),
                    getDoc(doc(db, 'Users', user.uid))
                ]);
                if (recieverSnapshot.exists()) {
                    setRecieverData(recieverSnapshot.data());
                    setLoading(false)
                }
                if (currentUserSnapshot.exists()) {
                    setUserData(currentUserSnapshot.data());
                }
            } catch (error) {
                console.error('Error fetching users data:', error);
            }
        };

        const fetchMessagesData = async () => {
            try {
                let combinedIds = await checkChatRoomExists(user.uid, receiver);
                // If chat room doesn't exist, create a new one
                if (!combinedIds) {
                    combinedIds = `${user.uid}-${receiver}`;
                }

                let chatDoc = doc(db, 'Chats', combinedIds);

                let unsubscribe = onSnapshot(chatDoc, async (doc) => {
                    if (doc.exists()) {
                        const chatData = doc.data();
                        setprevMsgs([...chatData.messages]);
                        chatData.messages.forEach(message => {
                            if (message.receiverId === user.uid && !message.seen) {
                                // If the receiver is the current user and the message hasn't been seen
                                updateMessageSeen(combinedIds, message.timestamp, true);
                            }
                        });
                    }
                });

                setLoading(false);
                return () => unsubscribe();
            } catch (error) {
                console.error('Error fetching messages data:', error);
            }
        };

        fetchMessagesData();
        setViewingChatRoom(true);

        fetchData();
        return () => {
            fetchMessagesData()
            setViewingChatRoom(false);
        };
    }, [user, receiver, isSent]);

    // Event listener for 'Enter' key press
    useEffect(() => {
        const keyDown = (e) => {
            if (e.key === 'Enter') {
                sendMsg();
            }
        };
        window.addEventListener('keydown', keyDown);

        return () => {
            window.removeEventListener('keydown', keyDown);
        };
    }, [userInput, loading]);

    const handleImageLoad = () => {
        setImagesLoaded((prev) => prev + 1); // Increment the count when an image is loaded
    };

    // Scroll to the bottom function
    const scrollToBottom = () => {
        if (messageBodyRef.current && !isScrolledManually) {
            messageBodyRef.current.scrollTop = messageBodyRef.current.scrollHeight;
        }

        if (bigCont.current && !isScrolledManually) {
            bigCont.current.scrollTop = bigCont.current.scrollHeight;
        }
    };

    // Event handler for manual scroll
    const handleScroll = (ref) => {
        const { scrollTop, scrollHeight, clientHeight } = ref.current;
        const isAtBottom = scrollHeight - scrollTop <= clientHeight + 5; // Small threshold
        setIsScrolledManually(!isAtBottom);
    };

    // Attach the handleScroll event listener
    useEffect(() => {
        const handleBodyScroll = () => handleScroll(messageBodyRef);
        const handleBigContScroll = () => handleScroll(bigCont);
    
        if (messageBodyRef.current) {
            messageBodyRef.current.addEventListener('scroll', handleBodyScroll);
        }
        if (bigCont.current) {
            bigCont.current.addEventListener('scroll', handleBigContScroll);
        }
    
        return () => {
            if (messageBodyRef.current) {
                messageBodyRef.current.removeEventListener('scroll', handleBodyScroll);
            }
            if (bigCont.current) {
                bigCont.current.removeEventListener('scroll', handleBigContScroll);
            }
        };
    }, []); // Empty dependency array ensures this runs once when the component mounts

    // Scroll to bottom when prevMsgs change
    useEffect(() => {
        scrollToBottom(); // Ensure we scroll to the bottom whenever new messages or images are fully loaded
        setViewingChatRoom(true);
        
        return () => {
            setViewingChatRoom(false); // Reset viewing state when the chat room changes or unmounts
        };
    }, [prevMsgs, chatId, imagesLoaded]);


    const handleViewChat = () =>{
        setViewingChatRoom(false);
      }
      

   return (
    <div ref={bigCont} className='scrollMsgbody overflow-hidden flex items-center justify-center'>
        <div className='text-slate-50 min-h-screen md:w-[40%] lg:w-[30%] p-4 bg-slate-900 hidden md:flex items-center justify-center flex-col rounded-lg shadow-lg'>
            <FontAwesomeIcon className='p-2 text-lg' icon={faHistory} />
            No chat history
        </div>

        <div className='w-full flex items-center justify-center flex-col'>
            <div className='fixed z-40 top-0 right-0 w-full md:w-[70.9%] lg:w-[76.55%] p-3 bg-blue-500 dark:bg-[rgba(30,41,59,.85)] backdrop-blur-md shadow-md flex items-center justify-between rounded-b-lg'>
                <div className='flex items-center justify-start gap-2'>
                    <Link to={`/chats`} onClick={handleViewChat}>
                        <FontAwesomeIcon className='text-slate-100 p-1 hover:text-slate-200 transition duration-200' icon={faArrowLeft} />
                    </Link>
                    <Link to={`/${recieverData?.username}`} className='shrink-0'>
                        <img src={recieverData?.profilePicture || userPhoto} alt="" loading='lazy' className='w-10 h-10 rounded-full object-cover shrink-0' />
                    </Link>
                    <div className='flex items-start ml-1 justify-center flex-col'>
                        <Link to={`/${recieverData?.username}`} className='text-white dark:text-slate-100 font-semibold'>{recieverData?.username}</Link>
                        {!loading && recieverData?.lastseen && (
                            <div className='text-slate-200 dark:text-slate-400 text-xs'>
                                {'last seen: ' + moment(recieverData?.lastseen).fromNow()}
                            </div>
                        )}
                        {!recieverData && (
                            <div className='animate-pulse dark:bg-slate-900 bg-slate-300 w-32 p-3 rounded-md'></div>
                        )}
                    </div>
                </div>
            </div>

            {/* Messages Body */}
            {loading && (
                <div className='mt-20 md:fixed md:top-0 w-full flex items-center justify-center gap-2 text-xl'>
                    <CircularProgress size={30} thickness={4} />
                </div>
            )}
            <div ref={messageBodyRef} className='w-full pt-[65px] p-1 overflow-x-hidden overflow-y-auto scrollMsgbody md:pb-[30px] lg:px-[170px] xl:px-[235px]' style={{ maxHeight: 'calc(100vh - 65px)' }}>
                {prevMsgs?.map((msg, i) => (
                    <div key={i} className={`w-auto h-auto p-2 flex ${msg.senderId === user?.uid ? 'justify-end' : 'justify-start'} clear-both items-center gap-x-1.5`}>
                        {msg.senderId !== user?.uid && <img src={recieverData?.profilePicture || userPhoto} className='w-[35px] h-[35px] rounded-full self-start border border-slate-300 dark:border-slate-800' alt="" />}
                        <li className={`max-[470px]:max-w-[65%] max-w-[55%] lg:max-w-[65%] break-words shadow-lg duration-200 rounded-xl ${msg.senderId === user?.uid ? 'bg-cyan-800 text-slate-100 dark:text-slate-200 dark:bg-slate-800' : 'bg-blue-100 text-slate-800 dark:text-slate-100 dark:bg-cyan-600'} list-none`}>
                            <div className='w-auto flex flex-col items-center justify-center'>
                                {msg.imageUrl && (
                                    <img src={msg.imageUrl} alt="Shared image" className="max-w-full h-auto rounded-t-xl" />
                                )}
                                <div className='w-full text-left px-4 p-2 pb-0.5'>
                                    {msg.message}
                                </div>
                            </div>
                            <div className='pt-0 p-1 px-2 w-full flex items-center justify-end'>
                                <div className={`text-xs ${msg.senderId === user?.uid ? 'text-slate-300 dark:text-slate-400' : 'text-slate-400 dark:text-slate-300'} p-1 pt-0`}>
                                    {msg.time}
                                </div>
                                {msg.senderId === user?.uid && (
                                    <div>
                                        {msg.seen ? (
                                            <span className="material-symbols-outlined flex items-center justify-center text-sm text-blue-500">
                                                done_all
                                            </span>
                                        ) : (
                                            <span className="material-symbols-outlined flex items-center justify-center text-sm text-slate-200">
                                                done
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </li>
                    </div>
                ))}
            </div>

            {/* Input Container */}
            <div onClick={handleFocus} className='fixed z-40 bottom-0 p-2 right-0 w-full md:w-[70.9%] lg:w-[76.55%] flex items-center bg-blue-500 dark:bg-[rgba(30,41,59,.85)] backdrop-blur-md shadow-md justify-center rounded-t-lg'>
                <div className='w-full flex items-center justify-center'>
                    <input onChange={HandleChange} ref={inpCont} value={userInput} type="text" placeholder='Message...' className='bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none w-[70%] md:w-[50%] sm:w-[60%] lg:w-[40%] xl:w-[35%] p-2 rounded-lg border border-slate-300 dark:border-slate-700 transition duration-200 focus:ring-2 focus:ring-blue-300' />
                    <label htmlFor="image-upload" className="cursor-pointer">
                        <FontAwesomeIcon icon={faImage} className="p-[9.5px] m-1 mt-2 text-slate-50 bg-blue-600 dark:bg-cyan-600 rounded-lg hover:bg-blue-700 transition duration-200" />
                    </label>
                    <input
                        id="image-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        ref={fileInputRef}
                        className="hidden"
                    />
                    <FontAwesomeIcon onClick={sendMsg} className={`${userInput.trim() || imageFile ? 'bg-blue-600 dark:bg-cyan-600' : 'bg-slate-700'} p-[9.5px] m-1 text-slate-50 rounded-lg cursor-pointer hover:bg-blue-700 transition duration-200`} icon={faPaperPlane} />
                </div>
            </div>
        </div>
    </div>
);

}

export default ChatScreen
