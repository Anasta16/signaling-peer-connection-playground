// on connection get all available offers and call getOfferEls
socket.on('availableOffers', offers => {
    console.log(offers)
    createOfferEls(offers);
});

// someone just made a new offer and we're already here - call createOfferEls
socket.on('newOfferWaiting', offers => {
    createOfferEls(offers);
})

function createOfferEls(offers) {
    // make green answer button for this new offer
    const answerEl = document.querySelector('#answer');
    offers.forEach(o => {
        console.log(o);
        const newOfferEl = document.createElement('div');
        newOfferEl.innerHTML = `<button class="btn btn-success col-1">Answer ${o.offererUserName}</button>`;
        newOfferEl.addEventListener('click', () => answerOffer(o));
        answerEl.appendChild(newOfferEl);
    })
}