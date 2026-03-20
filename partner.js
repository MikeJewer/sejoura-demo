document.addEventListener("DOMContentLoaded", async () => {
    // =======================
    // SUPABASE INIT
    // =======================

    const SUPABASE_URL = "https://lewkivfvhckrhmtoabqi.supabase.co";
    const SUPABASE_ANON_KEY = "sb_publishable_oVcA-sES82BYriJBU3YWPA_2m9pL7Sc";

    const { createClient } = supabase;
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // =======================
    // ELEMENTS
    // =======================

    const partnerContent = document.getElementById("partnerContent");

    // =======================
    // STATE
    // =======================

    let currentUser = null;
    let currentTrip = null;
    let currentOfferType = null;
    let currentDestination = null;
    let currentOffers = [];
    let selectedOfferIndex = 0;
    let isProcessingPayment = false;

    // =======================
    // OFFER DATA
    // =======================

    const PARTNER_OFFERS = {
        "Lisabon, Portugalsko": {
            flights: [
                {
                    title: "TAP Connect 201 · Lisboa Direct",
                    subtitle: "Praha → Lisabon · 1 příruční zavazadlo",
                    price: "4 990 Kč"
                },
                {
                    title: "Atlantic Air 508 · Smart Saver",
                    subtitle: "Praha → Lisabon · základní tarif",
                    price: "4 490 Kč"
                },
                {
                    title: "Blue Shore 110 · City Direct",
                    subtitle: "Vídeň → Lisabon · ranní odlet",
                    price: "5 290 Kč"
                }
            ],
            hotels: [
                {
                    title: "Hotel Aurelia Lisbon Central",
                    subtitle: "4★ · centrum města · snídaně v ceně",
                    price: "6 490 Kč"
                },
                {
                    title: "Marin Coast Suites Lisbon",
                    subtitle: "Boutique stay · moderní pokoje",
                    price: "7 190 Kč"
                },
                {
                    title: "Vista Alfama Rooms",
                    subtitle: "Historická čtvrť · menší městský hotel",
                    price: "5 790 Kč"
                }
            ]
        },
        "Nice, Francie": {
            flights: [
                {
                    title: "Azur Sky 144 · Riviera Direct",
                    subtitle: "Praha → Nice · odpolední odlet",
                    price: "5 790 Kč"
                },
                {
                    title: "SkyJet 214 · Economy Flex",
                    subtitle: "Vídeň → Nice · flexibilní tarif",
                    price: "6 090 Kč"
                },
                {
                    title: "Mediterranean Air 330 · Coast Saver",
                    subtitle: "Praha → Nice · cabin bag included",
                    price: "5 490 Kč"
                }
            ],
            hotels: [
                {
                    title: "Hotel Aurelia Bay Nice",
                    subtitle: "4★ · poblíž promenády",
                    price: "7 490 Kč"
                },
                {
                    title: "Marin Coast Suites Nice",
                    subtitle: "Stylový pobyt · blízko pláže",
                    price: "8 190 Kč"
                },
                {
                    title: "Vista Riviera Rooms",
                    subtitle: "Komorní hotel · staré město",
                    price: "6 890 Kč"
                }
            ]
        },
        "Split, Chorvatsko": {
            flights: [
                {
                    title: "Adriatic Wings 221 · Split Direct",
                    subtitle: "Praha → Split · večerní odlet",
                    price: "4 290 Kč"
                },
                {
                    title: "Blue Shore 410 · Coast Hopper",
                    subtitle: "Vídeň → Split · rychlý víkendový spoj",
                    price: "4 590 Kč"
                },
                {
                    title: "Dalma Air 118 · Smart Coast",
                    subtitle: "Praha → Split · economy light",
                    price: "3 990 Kč"
                }
            ],
            hotels: [
                {
                    title: "Hotel Aurelia Bay Split",
                    subtitle: "4★ · přístav a centrum v dosahu",
                    price: "5 990 Kč"
                },
                {
                    title: "Marin Coast Suites Split",
                    subtitle: "Moderní apartmánový styl",
                    price: "6 490 Kč"
                },
                {
                    title: "Vista Marina Rooms Split",
                    subtitle: "Jednodušší pobyt · blízko nábřeží",
                    price: "5 290 Kč"
                }
            ]
        }
    };

    // =======================
    // HELPERS
    // =======================

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function getGuideIncludedValue(rawValue) {
        return rawValue === true || rawValue === "true" || rawValue === "yes" || rawValue === 1;
    }

    function getUrlParams() {
        const params = new URLSearchParams(window.location.search);

        return {
            tripId: params.get("tripId"),
            offerType: params.get("offerType")
        };
    }

    async function syncCurrentUserFromSession() {
        const { data, error } = await supabaseClient.auth.getSession();

        if (error) {
            currentUser = null;
            return null;
        }

        currentUser = data?.session?.user ?? null;
        return currentUser;
    }

    function getOffersForDestination(destination, offerType) {
        const destinationConfig = PARTNER_OFFERS[destination];

        if (!destinationConfig) {
            return [];
        }

        if (offerType === "flight") {
            return destinationConfig.flights || [];
        }

        if (offerType === "hotel") {
            return destinationConfig.hotels || [];
        }

        return [];
    }

    function renderLoadingState() {
        if (!partnerContent) {
            return;
        }

        partnerContent.innerHTML = `
            <div class="partner-state">
                <p class="partner-eyebrow">Načítám partner nabídku</p>
                <h1>Připravuju checkout</h1>
                <p>Chvilka. Tahám data tripu a odpovídající nabídky.</p>
            </div>
        `;
    }

    function renderErrorState(title, message) {
        if (!partnerContent) {
            return;
        }

        partnerContent.innerHTML = `
            <div class="partner-state">
                <p class="partner-eyebrow">Partner checkout</p>
                <h1>${escapeHtml(title)}</h1>
                <p>${escapeHtml(message)}</p>
            </div>
        `;
    }

    function renderProcessingState(selectedOffer) {
        if (!partnerContent) {
            return;
        }

        partnerContent.innerHTML = `
            <div class="partner-state">
                <p class="partner-eyebrow">Zpracování platby</p>
                <h1>Probíhá dokončení objednávky</h1>
                <p>
                    Zpracovávám ${escapeHtml(currentOfferType === "flight" ? "let" : "hotel")}:
                    <strong>${escapeHtml(selectedOffer?.title || "")}</strong>
                </p>
                <div class="partner-loading">Čekej 3 vteřiny, ať to vypadá důležitě.</div>
            </div>
        `;
    }

    function renderPartnerPage() {
        if (!partnerContent || !currentTrip) {
            return;
        }

        const typeLabel = currentOfferType === "flight" ? "let" : "hotel";
        const currentSelection =
            currentOfferType === "flight"
                ? currentTrip.flight_name || "Nevybráno"
                : currentTrip.hotel_name || "Nevybráno";

        const offersHtml = currentOffers
            .map((offer, index) => {
                const isActive = index === selectedOfferIndex;

                return `
                    <div
                        class="partner-offer ${isActive ? "active" : ""}"
                        data-offer-index="${index}"
                    >
                        <div class="partner-offer-title">${escapeHtml(offer.title)}</div>
                        <div class="partner-offer-sub">${escapeHtml(offer.subtitle)}</div>
                        <div class="partner-offer-price">${escapeHtml(offer.price)}</div>
                    </div>
                `;
            })
            .join("");

        partnerContent.innerHTML = `
            <div class="partner-state" style="text-align:left; padding:0;">
                <p class="partner-eyebrow">Affiliate partner checkout</p>
                <h1>Vyber a zaplať ${escapeHtml(typeLabel)}</h1>
                <p style="margin-top:12px; opacity:0.85;">
                    Trip: <strong>${escapeHtml(currentTrip.title || "Bez názvu")}</strong><br />
                    Destinace: <strong>${escapeHtml(currentDestination)}</strong><br />
                    Aktuálně uložená volba: <strong>${escapeHtml(currentSelection)}</strong>
                </p>

                <div class="partner-offers">
                    ${offersHtml}
                </div>

                <div class="partner-actions">
                    <button class="partner-btn" id="confirmPartnerPaymentBtn" type="button">
                        Zaplatit ${escapeHtml(typeLabel)}
                    </button>
                </div>
            </div>
        `;

        const offerElements = partnerContent.querySelectorAll(".partner-offer");
        const confirmButton = document.getElementById("confirmPartnerPaymentBtn");

        offerElements.forEach((element) => {
            element.addEventListener("click", () => {
                if (isProcessingPayment) {
                    return;
                }

                const rawIndex = Number(element.dataset.offerIndex);

                if (!Number.isFinite(rawIndex) || rawIndex < 0 || rawIndex >= currentOffers.length) {
                    return;
                }

                selectedOfferIndex = rawIndex;
                renderPartnerPage();
            });
        });

        if (confirmButton) {
            confirmButton.addEventListener("click", async () => {
                await handlePartnerPayment();
            });
        }
    }

    function validateTripForCurrentStep(trip, offerType) {
        if (!trip) {
            return { ok: false, message: "Trip neexistuje." };
        }

        if (trip.status === "expired") {
            return { ok: false, message: "Tenhle trip už expiroval. Tady už nic nezaplatíš." };
        }

        if (trip.status === "completed") {
            return { ok: false, message: "Tenhle trip už je dokončený." };
        }

        const paymentStep = Number(trip.payment_step || 0);

        if (offerType === "flight") {
            if (trip.paid_flight) {
                return { ok: false, message: "Let už je u tohohle tripu zaplacený." };
            }

            if (paymentStep !== 0) {
                return { ok: false, message: "Let lze platit jen jako první krok." };
            }
        }

        if (offerType === "hotel") {
            if (!trip.paid_flight) {
                return { ok: false, message: "Nejdřív musíš zaplatit let." };
            }

            if (trip.paid_hotel) {
                return { ok: false, message: "Hotel už je u tohohle tripu zaplacený." };
            }

            if (paymentStep !== 1) {
                return { ok: false, message: "Hotel lze platit až po letu a jen jako druhý krok." };
            }
        }

        return { ok: true };
    }

    async function loadTripOrFail(tripId) {
        const { data, error } = await supabaseClient
            .from("trips")
            .select("*")
            .eq("id", tripId)
            .single();

        if (error) {
            console.error("[PARTNER] Trip load error:", error);
            renderErrorState("Trip se nepodařilo načíst", error.message);
            return null;
        }

        return data || null;
    }

    async function handlePartnerPayment() {
        if (isProcessingPayment) {
            return;
        }

        const selectedOffer = currentOffers[selectedOfferIndex];

        if (!selectedOffer) {
            alert("Nejdřív vyber nabídku.");
            return;
        }

        isProcessingPayment = true;
        renderProcessingState(selectedOffer);

        try {
            const tripId = currentTrip.id;
            const guideIncluded = getGuideIncludedValue(currentTrip.guide_included);

            let updatePayload = {};

            if (currentOfferType === "flight") {
                updatePayload = {
                    flight_name: selectedOffer.title,
                    paid_flight: true,
                    payment_step: 1,
                    status: "pending_payment"
                };
            } else if (currentOfferType === "hotel") {
                updatePayload = {
                    hotel_name: selectedOffer.title,
                    paid_hotel: true,
                    payment_step: 2,
                    status: guideIncluded ? "pending_payment" : "completed"
                };
            } else {
                throw new Error("Neplatný offerType.");
            }

            await new Promise((resolve) => setTimeout(resolve, 3000));

            const { data, error } = await supabaseClient
                .from("trips")
                .update(updatePayload)
                .eq("id", tripId)
                .eq("user_id", currentUser.id)
                .neq("status", "expired")
                .select("*")
                .single();

            if (error) {
                console.error("[PARTNER] Update error:", error);
                renderErrorState("Platba selhala", error.message);
                isProcessingPayment = false;
                return;
            }

            if (!data) {
                renderErrorState(
                    "Platba selhala",
                    "Trip se neupdatuje. Zkontroluj update policy nebo podmínky dotazu."
                );
                isProcessingPayment = false;
                return;
            }

            window.location.href = "index.html?section=my-trips";
        } catch (error) {
            console.error("[PARTNER] Unexpected payment error:", error);
            renderErrorState("Platba selhala", error.message || "Neočekávaná chyba.");
            isProcessingPayment = false;
        }
    }

    // =======================
    // INIT
    // =======================

    renderLoadingState();

    const { tripId, offerType } = getUrlParams();

    if (!tripId) {
        renderErrorState("Chybí tripId", "Partner stránka neví, pro jaký trip má pracovat.");
        return;
    }

    if (offerType !== "flight" && offerType !== "hotel") {
        renderErrorState("Neplatný offerType", "Partner stránka umí řešit jen flight nebo hotel.");
        return;
    }

    currentOfferType = offerType;

    await syncCurrentUserFromSession();

    if (!currentUser) {
        renderErrorState("Nejsi přihlášený", "Nejdřív se přihlas v hlavní appce.");
        return;
    }

    const trip = await loadTripOrFail(tripId);

    if (!trip) {
        renderErrorState("Trip neexistuje", "Trip se nepodařilo načíst nebo už neexistuje.");
        return;
    }

    if (String(trip.user_id) !== String(currentUser.id)) {
        renderErrorState("Přístup zamítnut", "Tenhle trip nepatří aktuálnímu uživateli.");
        return;
    }

    const validation = validateTripForCurrentStep(trip, offerType);

    if (!validation.ok) {
        renderErrorState("Tuhle platbu teď nejde provést", validation.message);
        return;
    }

    currentTrip = trip;
    currentDestination = trip.destination || "";

    if (!PARTNER_OFFERS[currentDestination]) {
        renderErrorState(
            "Pro tuto destinaci nejsou nabídky",
            "Tahle demo partner stránka zatím nemá připravené nabídky pro danou destinaci."
        );
        return;
    }

    currentOffers = getOffersForDestination(currentDestination, currentOfferType);

    if (!currentOffers.length) {
        renderErrorState(
            "Žádné nabídky",
            "Pro daný typ nabídky a destinaci se nic nenašlo."
        );
        return;
    }

    selectedOfferIndex = 0;
    renderPartnerPage();
});