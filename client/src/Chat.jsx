import React, { useContext, useEffect, useState } from 'react';
import Avatar from './Avatar';
import Logo from './Logo';
import { UserContext } from './UserContext.jsx'
import { uniqBy } from 'lodash'
import { useRef } from 'react';
import axios from 'axios';
import Contact from './Contact.jsx';

const Chat = () => {
    const [ws, setWs] = useState(null);
    const [onlinePeople, setOnlinePeople] = useState({});
    const [offlinePeople, setOfflinePeople] = useState([]);
    const [selectedUserId, setSelectedUserId] = useState(null);
    const { username, id, setId, setUsername } = useContext(UserContext);
    const [newMessageText, setNewMessageText] = useState('');
    const [messages, setMessages] = useState([]);
    const divUnderMessages = useRef();

    useEffect(() => {
        connectToWs();
    }, [selectedUserId]);

    function connectToWs() {
        const ws = new WebSocket('ws://localhost:4000');
        setWs(ws);
        ws.addEventListener('message', handleMessage);
        ws.addEventListener('close', () => {
            setTimeout(() => {
                console.log("Disconnected Trying to reconnect");
                connectToWs();
            }, 1000)
        });
    }

    function showOnlinePeople(peopleArray) {
        const people = {};
        peopleArray.forEach(({ userId, username }) => {
            people[userId] = username;
        });
        setOnlinePeople(people);
    }

    const handleMessage = (e) => {
        const messageData = JSON.parse(e.data);

        if ('online' in messageData)
            showOnlinePeople(messageData.online);
        else {
            setMessages(prev => ([...prev, { ...messageData }]))
        };

    };

    function selectContact(userId) {
        setSelectedUserId(userId);
    }

    function logout() {
        axios.post('/logout').then(() => {
            setWs(null);
            setId(null);
            setUsername(null);
        })
    }

    function sendMessage(ev) {
        ev.preventDefault();
        console.log("Sending");

        ws.send(JSON.stringify({
            message: {
                recipient: selectedUserId,
                text: newMessageText,
            }
        }));

        setMessages(prev => ([...prev, {
            text: newMessageText,
            sender: id,
            recipient: selectedUserId,
            _id: Date.now(),
        }]));
    }

    useEffect(() => {
        const div = divUnderMessages.current;
        if (div) {
            div.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }, [messages])

    useEffect(() => {
        axios.get('/people').then(res => {
            const offlinePeopleArr = res.data
                .filter(p => p._id !== id)
                .filter(p => !Object.keys(onlinePeople).includes(p._id));
            const offlinePeople = {};
            offlinePeopleArr.forEach(p => {
                offlinePeople[p._id] = p;
            })
            console.log({ offlinePeople, offlinePeopleArr });
            setOfflinePeople(offlinePeople);
        })
    }, [onlinePeople])




    useEffect(() => {
        if (selectedUserId) {
            axios.get('/messages/' + selectedUserId).then(res => {
                console.log("res.data is", res.data);
                setMessages(res.data);
            })
        }
    }, [selectedUserId])
    const onlinePeopleExcOurUser = { ...onlinePeople };

    delete onlinePeopleExcOurUser[id];
    console.log("Online People are : ", onlinePeopleExcOurUser)

    const messageWithoutDupes = uniqBy(messages, '_id');
    console.log("User id is", onlinePeopleExcOurUser)
    return (

        <div className="flex h-screen">
            <div className="bg-white w-1/3 flex flex-col">
                <div className='flex-grow'>

                    <Logo />

                    {Object.keys(onlinePeopleExcOurUser).map(userId => (
                        <Contact
                            key={userId}
                            id={userId}
                            online={true}
                            username={onlinePeopleExcOurUser[userId]}
                            onClick={() => { setSelectedUserId(userId) }}
                            selected={userId === selectedUserId} />
                        // console.log("Username is",selectedUserId)
                    ))}

                    {Object.keys(offlinePeople).map(userId => (
                        <Contact
                            key={userId}
                            id={userId}
                            online={false}
                            username={offlinePeople[userId].username}
                            onClick={() => { setSelectedUserId(userId) }}
                            selected={userId === selectedUserId} />
                        // console.log("Username is",selectedUserId)
                    ))}
                </div>
                <div className='p-2 text-center flex items-center justify-center'>
                    <span className='mr-2 text-sm text-gray-500 flex items-center'>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                            <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd" />
                        </svg>
                        {username}</span>
                    <button
                        onClick={logout}
                        className='text-sm bg-blue-100 py-1 px-2 text-gray-500 border rounded-sm'>Logout
                    </button>
                </div>
            </div>
            <div className="flex flex-col bg-blue-50 w-2/3 p-2">
                <div className="flex-grow">
                    {
                        !selectedUserId && (
                            <div className='flex h-full items-center justify-center'>
                                <div className='text-gray-400'>
                                    &larr; Select A Person from the sidebar
                                </div>

                            </div>
                        )
                    }
                    {!!selectedUserId && (
                        <div className="relative h-full">
                            <div className="overflow-y-scroll absolute top-0 left-0 right-0 bottom-2">
                                {messageWithoutDupes.map(message => (
                                    <div key={message._id} className={(message.sender === id ? 'text-right' : 'text-left')}>
                                        <div className={"text-left inline-block p-2 my-2 rounded-md text-sm " + (message.sender === id ? 'bg-blue-500 text-white' : 'bg-white text-gray-500')}>
                                            {message.text}
                                            {message.file && (
                                                <div className="">
                                                    <a target="_blank" className="flex items-center gap-1 border-b" href={axios.defaults.baseURL + '/uploads/' + message.file}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                                            <path fillRule="evenodd" d="M18.97 3.659a2.25 2.25 0 00-3.182 0l-10.94 10.94a3.75 3.75 0 105.304 5.303l7.693-7.693a.75.75 0 011.06 1.06l-7.693 7.693a5.25 5.25 0 11-7.424-7.424l10.939-10.94a3.75 3.75 0 115.303 5.304L9.097 18.835l-.008.008-.007.007-.002.002-.003.002A2.25 2.25 0 015.91 15.66l7.81-7.81a.75.75 0 011.061 1.06l-7.81 7.81a.75.75 0 001.054 1.068L18.97 6.84a2.25 2.25 0 000-3.182z" clipRule="evenodd" />
                                                        </svg>
                                                        {message.file}
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                <div ref={divUnderMessages}></div>
                            </div>
                        </div>
                    )}
                </div>
                {!!selectedUserId && (
                    <form className="flex gap-2" onSubmit={sendMessage}>
                        <input

                            onChange={ev => setNewMessageText(ev.target.value)}
                            type="text"
                            placeholder="Type Your Message Here"
                            className="bg-white flex-grow border rounded-sm p-2"
                        />
                        <button type="submit" className="bg-blue-500 p-2 text-white rounded-sm">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={1.5}
                                stroke="currentColor"
                                className="w-6 h-6"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"
                                />
                            </svg>
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default Chat;
