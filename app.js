document.addEventListener("DOMContentLoaded", async () => {
    // =======================
    // SUPABASE INIT
    // =======================

    const SUPABASE_URL = "https://lewkivfvhckrhmtoabqi.supabase.co";
    const SUPABASE_ANON_KEY = "sb_publishable_oVcA-sES82BYriJBU3YWPA_2m9pL7Sc";

    const { createClient } = supabase;
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // =======================
    // RUNTIME STATE
    // =======================

    let currentUser = null;
    let isLogoutInProgress = false;
    let tripsLoadVersion = 0;
    let currentTrips = [];
    let tripsRealtimeChannel = null;

    // =======================
    // NAVIGATION
    // =======================

    const navButtons = document.querySelectorAll(".nav-link");
    const pageSections = document.querySelectorAll(".page-section");
    const quickNavButtons = document.querySelectorAll("[data-section-target]");
    const navToggle = document.getElementById("navToggle");
    const mainNav = document.getElementById("mainNav");

    function showSection(sectionId) {
        pageSections.forEach((section) => {
            section.classList.toggle("active", section.id === sectionId);
        });

        navButtons.forEach((button) => {
            button.classList.toggle("active", button.dataset.section === sectionId);
        });

        if (mainNav) {
            mainNav.classList.remove("open");
        }

        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    navButtons.forEach((button) => {
        button.addEventListener("click", () => {
            showSection(button.dataset.section);
        });
    });

    quickNavButtons.forEach((button) => {
        button.addEventListener("click", () => {
            showSection(button.dataset.sectionTarget);
        });
    });

    if (navToggle && mainNav) {
        navToggle.addEventListener("click", () => {
            mainNav.classList.toggle("open");
        });
    }

    // =======================
    // BUILDER ELEMENTS
    // =======================

    const tripTitleInput = document.getElementById("tripTitle");
    const destinationInput = document.getElementById("destination");
    const startDateInput = document.getElementById("startDate");
    const endDateInput = document.getElementById("endDate");
    const travelersInput = document.getElementById("travelers");
    const flightNameInput = document.getElementById("flightName");
    const hotelNameInput = document.getElementById("hotelName");
    const guideIncludedInput = document.getElementById("guideIncluded");

    const summaryTitle = document.getElementById("summaryTitle");
    const summaryDestination = document.getElementById("summaryDestination");
    const summaryDates = document.getElementById("summaryDates");
    const summaryTravelers = document.getElementById("summaryTravelers");
    const summaryFlight = document.getElementById("summaryFlight");
    const summaryHotel = document.getElementById("summaryHotel");
    const summaryGuide = document.getElementById("summaryGuide");

    const tripBuilderForm = document.getElementById("tripBuilderForm");

    // =======================
    // MY TRIPS ELEMENTS
    // =======================

    const emptyTripsState = document.getElementById("emptyTripsState");
    const tripsList = document.getElementById("tripsList");

    // =======================
    // AUTH ELEMENTS
    // =======================

    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");
    const logoutButton = document.getElementById("logoutButton");

    const authStatusText = document.getElementById("authStatusText");
    const authStatusSubtext = document.getElementById("authStatusSubtext");

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

    function formatDateRange(startDate, endDate) {
        if (!startDate || !endDate) {
            return "Vyber datum";
        }

        return `${startDate} → ${endDate}`;
    }

    function formatTripDate(dateValue) {
        if (!dateValue) {
            return "Neuvedeno";
        }

        return dateValue;
    }

    function formatCreatedAt(dateValue) {
        if (!dateValue) {
            return "";
        }

        const date = new Date(dateValue);
        return date.toLocaleString("cs-CZ");
    }

    function getGuideIncludedValue(rawValue) {
        return rawValue === true || rawValue === "true" || rawValue === "yes" || rawValue === 1;
    }

    function getFinalPaymentStep(trip) {
        return getGuideIncludedValue(trip?.guide_included) ? 3 : 2;
    }

    function getReadableTripStatus(trip) {
        const rawStatus = trip?.status || "draft";

        switch (rawStatus) {
            case "completed":
                return "Dokončeno";
            case "pending_payment":
                return "Čeká na platbu";
            case "expired":
                return "Expirováno";
            case "draft":
            default:
                return "Draft";
        }
    }

    function canDeleteTrip(trip) {
        const status = trip?.status || "draft";
        return status === "draft" || status === "expired";
    }

    function canRunPaymentFlow(trip) {
        const status = trip?.status || "draft";
        return status !== "expired" && status !== "completed";
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

    function invalidateTripsRequests() {
        tripsLoadVersion += 1;
    }

    function setLoggedOutTripsState() {
        currentTrips = [];

        if (!emptyTripsState || !tripsList) {
            return;
        }

        emptyTripsState.classList.remove("hidden");
        emptyTripsState.innerHTML = `
            <h3>Pro zobrazení cest se přihlas</h3>
            <p>
                Tvoje uložené tripy zobrazíme až po přihlášení.
            </p>
            <button class="btn btn-secondary" type="button" id="goToAuthButton">
                Jít na přihlášení
            </button>
        `;

        tripsList.classList.add("hidden");
        tripsList.innerHTML = "";

        const authButton = document.getElementById("goToAuthButton");
        if (authButton) {
            authButton.addEventListener("click", () => {
                showSection("auth");
            });
        }
    }

    function setEmptyTripsState() {
        currentTrips = [];

        if (!emptyTripsState || !tripsList) {
            return;
        }

        emptyTripsState.classList.remove("hidden");
        emptyTripsState.innerHTML = `
            <h3>Zatím žádné uložené cesty</h3>
            <p>
                Jakmile vytvoříš svůj první trip, objeví se tady.
            </p>
            <button class="btn btn-secondary" type="button" id="goToBuilderButton">
                Jít do builderu
            </button>
        `;

        tripsList.classList.add("hidden");
        tripsList.innerHTML = "";

        const builderButton = document.getElementById("goToBuilderButton");
        if (builderButton) {
            builderButton.addEventListener("click", () => {
                showSection("builder");
            });
        }
    }

    function setTripsLoadingState() {
        if (!emptyTripsState || !tripsList) {
            return;
        }

        emptyTripsState.classList.remove("hidden");
        emptyTripsState.innerHTML = `
            <h3>Načítám tvoje cesty...</h3>
            <p>
                Chvilka, tahám to z databáze.
            </p>
        `;

        tripsList.classList.add("hidden");
        tripsList.innerHTML = "";
    }

    function updateSummary() {
        if (
            !tripTitleInput ||
            !destinationInput ||
            !startDateInput ||
            !endDateInput ||
            !travelersInput ||
            !flightNameInput ||
            !hotelNameInput ||
            !guideIncludedInput ||
            !summaryTitle ||
            !summaryDestination ||
            !summaryDates ||
            !summaryTravelers ||
            !summaryFlight ||
            !summaryHotel ||
            !summaryGuide
        ) {
            return;
        }

        const titleValue = tripTitleInput.value.trim() || "Jarní víkend v Lisabonu";
        const destinationValue = destinationInput.value;
        const startDateValue = startDateInput.value;
        const endDateValue = endDateInput.value;
        const travelersValue = travelersInput.value || "2";
        const flightValue = flightNameInput.value;
        const hotelValue = hotelNameInput.value;
        const guideValue = guideIncludedInput.value === "yes" ? "Ano" : "Ne";

        summaryTitle.textContent = titleValue;
        summaryDestination.textContent = destinationValue;
        summaryDates.textContent = formatDateRange(startDateValue, endDateValue);
        summaryTravelers.textContent = `${travelersValue} ${Number(travelersValue) === 1 ? "osoba" : "osoby"}`;
        summaryFlight.textContent = flightValue;
        summaryHotel.textContent = hotelValue;
        summaryGuide.textContent = guideValue;
    }

    // =======================
    // REALTIME
    // =======================

    function unsubscribeTripsRealtime() {
        if (tripsRealtimeChannel) {
            supabaseClient.removeChannel(tripsRealtimeChannel);
            tripsRealtimeChannel = null;
        }
    }

    function subscribeToTripsRealtime() {
        unsubscribeTripsRealtime();

        tripsRealtimeChannel = supabaseClient
            .channel("public:trips-live")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "trips"
                },
                async (payload) => {
                    if (!currentUser) {
                        return;
                    }

                    const payloadUserId =
                        payload?.new?.user_id ||
                        payload?.old?.user_id ||
                        null;

                    if (!payloadUserId || payloadUserId === currentUser.id) {
                        await loadMyTrips();
                    }
                }
            )
            .subscribe((status) => {
                console.log("[REALTIME] trips subscription status:", status);
            });
    }

    // =======================
    // PAYMENT FLOW
    // =======================

    async function updateTripStep(tripId, requestedStep) {
        try {
            if (!currentUser) {
                await syncCurrentUserFromSession();
            }

            if (!currentUser) {
                alert("Nejdřív se přihlas.");
                showSection("auth");
                return;
            }

            const trip = currentTrips.find((item) => String(item.id) === String(tripId));

            if (!trip) {
                alert("Trip se nepodařilo najít v aktuálním seznamu. Zkus reload.");
                await loadMyTrips();
                return;
            }

            if (trip.status === "expired") {
                alert("Tento trip už expiroval. Payment flow je uzavřený.");
                return;
            }

            if (trip.status === "completed") {
                alert("Tenhle trip už je dokončený.");
                return;
            }

            const currentStep = Number(trip.payment_step || 0);
            const guideIncluded = getGuideIncludedValue(trip.guide_included);
            const finalStep = getFinalPaymentStep(trip);

            let nextStep = Number(requestedStep);

            if (!Number.isFinite(nextStep) || nextStep < 1) {
                nextStep = 1;
            }

            if (nextStep > finalStep) {
                nextStep = finalStep;
            }

            if (nextStep <= currentStep) {
                return;
            }

            if (nextStep > currentStep + 1) {
                alert("Nejdřív zaplať předchozí krok. Tohle není speedrun přes zeď.");
                return;
            }

            const updateData = {
                payment_step: nextStep,
                status: nextStep >= finalStep ? "completed" : "pending_payment",
                paid_flight: nextStep >= 1,
                paid_hotel: nextStep >= 2,
                paid_guide: guideIncluded ? nextStep >= 3 : false
            };

            console.log("[PAYMENT] Updating trip", {
                tripId,
                currentUserId: currentUser.id,
                currentStep,
                requestedStep,
                finalStep,
                updateData
            });

            const { data, error } = await supabaseClient
                .from("trips")
                .update(updateData)
                .eq("id", tripId)
                .eq("user_id", currentUser.id)
                .neq("status", "expired")
                .select("*")
                .single();

            if (error) {
                console.error("[PAYMENT] Update error:", error);
                alert("Chyba při update tripu: " + error.message);
                return;
            }

            if (!data) {
                console.warn("[PAYMENT] No row returned after update.");
                alert("Trip se neupdatuje. Zkontroluj RLS policy pro UPDATE.");
                return;
            }

            console.log("[PAYMENT] Update success:", data);

            await loadMyTrips();
        } catch (error) {
            console.error("[PAYMENT] Unexpected error:", error);
            alert("Neočekávaná chyba při payment flow: " + error.message);
        }
    }

    async function deleteTrip(tripId) {
        try {
            if (!currentUser) {
                await syncCurrentUserFromSession();
            }

            if (!currentUser) {
                alert("Nejdřív se přihlas.");
                showSection("auth");
                return;
            }

            const trip = currentTrips.find((item) => String(item.id) === String(tripId));

            if (!trip) {
                alert("Trip se nepodařilo najít. Zkus reload.");
                await loadMyTrips();
                return;
            }

            if (!canDeleteTrip(trip)) {
                alert("Tenhle trip nejde odstranit. Mazat lze jen draft nebo expired.");
                return;
            }

            const confirmed = window.confirm(
                `Opravdu chceš odstranit trip "${trip.title || "Bez názvu"}"?`
            );

            if (!confirmed) {
                return;
            }

            const { error } = await supabaseClient
                .from("trips")
                .delete()
                .eq("id", tripId)
                .eq("user_id", currentUser.id)
                .in("status", ["draft", "expired"]);

            if (error) {
                console.error("[TRIP DELETE] Delete error:", error);
                alert("Chyba při mazání tripu: " + error.message);
                return;
            }

            currentTrips = currentTrips.filter((item) => String(item.id) !== String(tripId));
            renderTrips(currentTrips);
        } catch (error) {
            console.error("[TRIP DELETE] Unexpected delete error:", error);
            alert("Neočekávaná chyba při mazání tripu: " + error.message);
        }
    }

    window.updateTripStep = updateTripStep;
    window.deleteTrip = deleteTrip;

    function renderExpiredNotice(trip) {
        if (trip?.status !== "expired") {
            return "";
        }

        return `
            <div class="trip-expired-notice" style="margin-top: 16px; padding: 12px; border-radius: 12px; border: 1px solid rgba(255, 120, 120, 0.35); background: rgba(255, 120, 120, 0.08);">
                <strong>⏰ Nabídka expirovala</strong>
                <p style="margin: 8px 0 0 0;">
                    Tato nabídka expirovala, protože nedošlo k dokončení platby v časovém limitu.
                </p>
            </div>
        `;
    }

    function renderTripActionButtons(trip) {
        if (!canDeleteTrip(trip)) {
            return "";
        }

        return `
            <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:12px;">
                <button
                    class="btn btn-secondary trip-delete-btn"
                    type="button"
                    data-trip-id="${escapeHtml(trip.id)}"
                >
                    Odstranit trip
                </button>
            </div>
        `;
    }

    function renderPaymentButtons(trip) {
        const step = Number(trip.payment_step || 0);
        const guideIncluded = getGuideIncludedValue(trip.guide_included);
        const finalStep = getFinalPaymentStep(trip);
        const status = trip.status || "draft";

        if (status === "expired") {
            return `
                ${renderExpiredNotice(trip)}
                ${renderTripActionButtons(trip)}
            `;
        }

        if (status === "completed" || step >= finalStep) {
            return `
                <div style="margin-top: 16px;">
                    <div class="summary-item">
                        <span>Stav</span>
                        <strong>✅ Trip dokončen</strong>
                    </div>
                    <div class="summary-item">
                        <span>Payment step</span>
                        <strong>${finalStep} / ${finalStep}</strong>
                    </div>
                </div>
            `;
        }

        const canPayFlight = canRunPaymentFlow(trip) && step === 0;
        const canPayHotel = canRunPaymentFlow(trip) && step === 1;
        const canPayGuide = canRunPaymentFlow(trip) && guideIncluded && step === 2;

        return `
            <div style="margin-top: 16px;">
                <div class="summary-list">
                    <div class="summary-item">
                        <span>Fake affiliate flow</span>
                        <strong>Krok ${step} / ${finalStep}</strong>
                    </div>
                    <div class="summary-item">
                        <span>Zaplacený let</span>
                        <strong>${trip.paid_flight ? "Ano" : "Ne"}</strong>
                    </div>
                    <div class="summary-item">
                        <span>Zaplacený hotel</span>
                        <strong>${trip.paid_hotel ? "Ano" : "Ne"}</strong>
                    </div>
                    <div class="summary-item">
                        <span>Zaplacený guide</span>
                        <strong>${guideIncluded ? (trip.paid_guide ? "Ano" : "Ne") : "Není součástí"}</strong>
                    </div>
                </div>

                <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:12px;">
                    ${
                        trip.paid_flight
                            ? `<span>✔ Let zaplacen</span>`
                            : `
                                <button
                                    class="btn btn-primary trip-payment-btn"
                                    type="button"
                                    data-trip-id="${escapeHtml(trip.id)}"
                                    data-offer-type="flight"
                                    ${canPayFlight ? "" : "disabled"}
                                >
                                    Zaplat let ✈️
                                </button>
                            `
                    }

                    ${
                        trip.paid_hotel
                            ? `<span>✔ Hotel zaplacen</span>`
                            : `
                                <button
                                    class="btn btn-secondary trip-payment-btn"
                                    type="button"
                                    data-trip-id="${escapeHtml(trip.id)}"
                                    data-offer-type="hotel"
                                    ${canPayHotel ? "" : "disabled"}
                                >
                                    Zaplat hotel 🏨
                                </button>
                            `
                    }

                    ${
                        !guideIncluded
                            ? `<span>Guide není součástí</span>`
                            : trip.paid_guide
                                ? `<span>✔ Guide zaplacen</span>`
                                : `
                                    <button
                                        class="btn btn-secondary trip-payment-btn"
                                        type="button"
                                        data-trip-id="${escapeHtml(trip.id)}"
                                        data-step="3"
                                        ${canPayGuide ? "" : "disabled"}
                                    >
                                        Zaplat guide 🧭
                                    </button>
                                `
                    }
                </div>

                ${renderTripActionButtons(trip)}
            </div>
        `;
    }

    function renderTrips(trips) {
        if (!emptyTripsState || !tripsList) {
            return;
        }

        if (!trips || trips.length === 0) {
            setEmptyTripsState();
            return;
        }

        currentTrips = trips;

        emptyTripsState.classList.add("hidden");
        tripsList.classList.remove("hidden");

        tripsList.innerHTML = trips
            .map((trip) => {
                return `
                    <article class="offer-card">
                        <div class="offer-badge">Uložený trip</div>
                        <h3>${escapeHtml(trip.title || "Bez názvu")}</h3>
                        <p class="offer-location">${escapeHtml(trip.destination || "Bez destinace")}</p>
                        <div class="summary-list">
                            <div class="summary-item">
                                <span>Datum od</span>
                                <strong>${escapeHtml(formatTripDate(trip.start_date))}</strong>
                            </div>
                            <div class="summary-item">
                                <span>Datum do</span>
                                <strong>${escapeHtml(formatTripDate(trip.end_date))}</strong>
                            </div>
                            <div class="summary-item">
                                <span>Cestující</span>
                                <strong>${escapeHtml(trip.travelers ?? "Neuvedeno")}</strong>
                            </div>
                            <div class="summary-item">
                                <span>Let</span>
                                <strong>${escapeHtml(trip.flight_name || "Neuvedeno")}</strong>
                            </div>
                            <div class="summary-item">
                                <span>Hotel</span>
                                <strong>${escapeHtml(trip.hotel_name || "Neuvedeno")}</strong>
                            </div>
                            <div class="summary-item">
                                <span>Guide</span>
                                <strong>${getGuideIncludedValue(trip.guide_included) ? "Ano" : "Ne"}</strong>
                            </div>
                            <div class="summary-item">
                                <span>Status</span>
                                <strong>${escapeHtml(getReadableTripStatus(trip))}</strong>
                            </div>
                            <div class="summary-item">
                                <span>Payment step</span>
                                <strong>${escapeHtml(Number(trip.payment_step || 0))}</strong>
                            </div>
                        </div>

                        <p class="section-subtext" style="margin-top: 16px;">
                            Vytvořeno: ${escapeHtml(formatCreatedAt(trip.created_at))}
                        </p>

                        ${renderPaymentButtons(trip)}
                    </article>
                `;
            })
            .join("");
    }

    async function loadMyTrips() {
        if (!emptyTripsState || !tripsList) {
            return;
        }

        const requestVersion = ++tripsLoadVersion;

        if (!currentUser) {
            setLoggedOutTripsState();
            return;
        }

        setTripsLoadingState();

        try {
            const { data, error } = await supabaseClient
                .from("trips")
                .select("*")
                .eq("user_id", currentUser.id)
                .order("created_at", { ascending: false });

            if (requestVersion !== tripsLoadVersion) {
                return;
            }

            if (!currentUser) {
                setLoggedOutTripsState();
                return;
            }

            if (error) {
                console.error("[TRIPS] Load error:", error);
                emptyTripsState.classList.remove("hidden");
                emptyTripsState.innerHTML = `
                    <h3>Nepodařilo se načíst cesty</h3>
                    <p>${escapeHtml(error.message)}</p>
                `;
                tripsList.classList.add("hidden");
                tripsList.innerHTML = "";
                currentTrips = [];
                return;
            }

            renderTrips(data || []);
        } catch (error) {
            if (requestVersion !== tripsLoadVersion) {
                return;
            }

            if (!currentUser) {
                setLoggedOutTripsState();
                return;
            }

            console.error("[TRIPS] Unexpected load error:", error);

            emptyTripsState.classList.remove("hidden");
            emptyTripsState.innerHTML = `
                <h3>Nepodařilo se načíst cesty</h3>
                <p>${escapeHtml(error.message)}</p>
            `;
            tripsList.classList.add("hidden");
            tripsList.innerHTML = "";
            currentTrips = [];
        }
    }

    function updateAuthUI() {
        if (!authStatusText || !authStatusSubtext || !logoutButton) {
            return;
        }

        if (currentUser) {
            authStatusText.textContent = "Přihlášený uživatel";
            authStatusSubtext.textContent = currentUser.email || "Bez emailu";
            logoutButton.disabled = false;
            logoutButton.style.opacity = "1";
            logoutButton.style.pointerEvents = "auto";
            logoutButton.textContent = isLogoutInProgress ? "Odhlašuji..." : "Odhlásit";
        } else {
            authStatusText.textContent = "Nepřihlášený uživatel";
            authStatusSubtext.textContent = "Přihlas se nebo si vytvoř účet.";
            logoutButton.disabled = true;
            logoutButton.style.opacity = "0.6";
            logoutButton.style.pointerEvents = "none";
            logoutButton.textContent = "Odhlásit";
        }
    }

    async function refreshAuthAndTrips() {
        await syncCurrentUserFromSession();
        updateAuthUI();
        await loadMyTrips();
    }

    // =======================
    // BUILDER SUMMARY EVENTS
    // =======================

    [
        tripTitleInput,
        destinationInput,
        startDateInput,
        endDateInput,
        travelersInput,
        flightNameInput,
        hotelNameInput,
        guideIncludedInput
    ].forEach((field) => {
        if (field) {
            field.addEventListener("input", updateSummary);
            field.addEventListener("change", updateSummary);
        }
    });

    // =======================
    // MY TRIPS EVENTS
    // =======================

    if (tripsList) {
        tripsList.addEventListener("click", async (event) => {
            const paymentButton = event.target.closest(".trip-payment-btn");
            const deleteButton = event.target.closest(".trip-delete-btn");

            if (paymentButton) {
                const tripId = paymentButton.dataset.tripId;
                const offerType = paymentButton.dataset.offerType;
                const step = Number(paymentButton.dataset.step);

                if (!tripId) {
                    return;
                }

                if (offerType === "flight" || offerType === "hotel") {
                    window.location.href = `partner.html?tripId=${encodeURIComponent(tripId)}&offerType=${encodeURIComponent(offerType)}`;
                    return;
                }

                if (!step) {
                    return;
                }

                const originalText = paymentButton.textContent;
                paymentButton.disabled = true;
                paymentButton.textContent = "Zpracovávám...";

                try {
                    await updateTripStep(tripId, step);
                } finally {
                    paymentButton.disabled = false;
                    paymentButton.textContent = originalText;
                }

                return;
            }

            if (deleteButton) {
                const tripId = deleteButton.dataset.tripId;

                if (!tripId) {
                    return;
                }

                const originalText = deleteButton.textContent;
                deleteButton.disabled = true;
                deleteButton.textContent = "Mažu...";

                try {
                    await deleteTrip(tripId);
                } finally {
                    deleteButton.disabled = false;
                    deleteButton.textContent = originalText;
                }
            }
        });
    }

    // =======================
    // REGISTER
    // =======================

    if (registerForm) {
        registerForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const emailInput = document.getElementById("registerEmail");
            const passwordInput = document.getElementById("registerPassword");

            const email = emailInput ? emailInput.value.trim() : "";
            const password = passwordInput ? passwordInput.value : "";

            const { error } = await supabaseClient.auth.signUp({
                email,
                password
            });

            if (error) {
                alert("Chyba: " + error.message);
                return;
            }

            alert("Registrace proběhla. Pokud máš v Supabase zapnuté potvrzení emailu, zkontroluj schránku.");
            await refreshAuthAndTrips();
        });
    }

    // =======================
    // LOGIN
    // =======================

    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const emailInput = document.getElementById("loginEmail");
            const passwordInput = document.getElementById("loginPassword");

            const email = emailInput ? emailInput.value.trim() : "";
            const password = passwordInput ? passwordInput.value : "";

            const { error } = await supabaseClient.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                alert("Chyba: " + error.message);
                return;
            }

            await refreshAuthAndTrips();
            alert("Přihlášení úspěšné");
            showSection("home");
        });
    }

    // =======================
    // LOGOUT
    // =======================

    async function handleLogout() {
        if (!logoutButton || isLogoutInProgress || !currentUser) {
            return;
        }

        isLogoutInProgress = true;
        logoutButton.disabled = true;
        logoutButton.style.opacity = "0.6";
        logoutButton.style.pointerEvents = "none";
        logoutButton.textContent = "Odhlašuji...";

        currentUser = null;
        invalidateTripsRequests();
        updateAuthUI();
        setLoggedOutTripsState();
        unsubscribeTripsRealtime();

        try {
            const { error } = await supabaseClient.auth.signOut();

            if (error) {
                await syncCurrentUserFromSession();
                updateAuthUI();

                if (currentUser) {
                    subscribeToTripsRealtime();
                    await loadMyTrips();
                }

                alert("Chyba při odhlášení: " + error.message);
                return;
            }

            showSection("home");
            alert("Odhlášeno");
        } finally {
            isLogoutInProgress = false;
            await syncCurrentUserFromSession();
            updateAuthUI();

            if (!currentUser) {
                invalidateTripsRequests();
                setLoggedOutTripsState();
                unsubscribeTripsRealtime();
            } else {
                subscribeToTripsRealtime();
                await loadMyTrips();
            }
        }
    }

    if (logoutButton) {
        logoutButton.addEventListener("click", handleLogout);
    }

    // =======================
    // SAVE TRIP
    // =======================

    if (tripBuilderForm) {
        tripBuilderForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            try {
                if (!currentUser) {
                    await syncCurrentUserFromSession();
                }

                if (!currentUser) {
                    alert("Nejdřív se přihlas nebo zaregistruj.");
                    showSection("auth");
                    return;
                }

                const title = tripTitleInput.value.trim() || "Můj trip";
                const destination = destinationInput.value;
                const startDate = startDateInput.value || null;
                const endDate = endDateInput.value || null;
                const travelers = Number(travelersInput.value) || 1;
                const flightName = flightNameInput.value;
                const hotelName = hotelNameInput.value;
                const guideIncluded = guideIncludedInput.value === "yes";

                const tripPayload = {
                    user_id: currentUser.id,
                    title: title,
                    destination: destination,
                    start_date: startDate,
                    end_date: endDate,
                    travelers: travelers,
                    flight_name: flightName,
                    hotel_name: hotelName,
                    guide_included: guideIncluded,
                    status: "draft",
                    payment_step: 0,
                    paid_flight: false,
                    paid_hotel: false,
                    paid_guide: false
                };

                console.log("[TRIP] Inserting payload:", tripPayload);

                const { error: insertError } = await supabaseClient
                    .from("trips")
                    .insert([tripPayload]);

                if (insertError) {
                    console.error("[TRIP] Insert error:", insertError);
                    alert("Chyba při ukládání tripu: " + insertError.message);
                    return;
                }

                alert("Trip byl úspěšně uložen.");

                tripBuilderForm.reset();

                if (travelersInput) {
                    travelersInput.value = 2;
                }

                if (guideIncludedInput) {
                    guideIncludedInput.value = "yes";
                }

                updateSummary();
                await loadMyTrips();
                showSection("my-trips");
            } catch (error) {
                console.error("[TRIP] Unexpected insert error:", error);
                alert("Chyba při ukládání tripu: " + error.message);
            }
        });
    }

    // =======================
    // INIT
    // =======================

    updateSummary();
    await refreshAuthAndTrips();

    if (currentUser) {
        subscribeToTripsRealtime();
    }

    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
        currentUser = session?.user ?? null;

        if (!currentUser) {
            invalidateTripsRequests();
            updateAuthUI();
            setLoggedOutTripsState();
            unsubscribeTripsRealtime();
            return;
        }

        updateAuthUI();
        subscribeToTripsRealtime();
        await loadMyTrips();
    });
});
