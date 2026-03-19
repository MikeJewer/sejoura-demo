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

    function renderTrips(trips) {
        if (!emptyTripsState || !tripsList) {
            return;
        }

        if (!trips || trips.length === 0) {
            setEmptyTripsState();
            return;
        }

        emptyTripsState.classList.add("hidden");
        tripsList.classList.remove("hidden");

        tripsList.innerHTML = trips
            .map((trip) => {
                return `
                    <article class="offer-card">
                        <div class="offer-badge">Uložený trip</div>
                        <h3>${trip.title || "Bez názvu"}</h3>
                        <p class="offer-location">${trip.destination || "Bez destinace"}</p>
                        <div class="summary-list">
                            <div class="summary-item">
                                <span>Datum od</span>
                                <strong>${formatTripDate(trip.start_date)}</strong>
                            </div>
                            <div class="summary-item">
                                <span>Datum do</span>
                                <strong>${formatTripDate(trip.end_date)}</strong>
                            </div>
                            <div class="summary-item">
                                <span>Cestující</span>
                                <strong>${trip.travelers ?? "Neuvedeno"}</strong>
                            </div>
                            <div class="summary-item">
                                <span>Let</span>
                                <strong>${trip.flight_name || "Neuvedeno"}</strong>
                            </div>
                            <div class="summary-item">
                                <span>Hotel</span>
                                <strong>${trip.hotel_name || "Neuvedeno"}</strong>
                            </div>
                            <div class="summary-item">
                                <span>Guide</span>
                                <strong>${trip.guide_included ? "Ano" : "Ne"}</strong>
                            </div>
                        </div>
                        <p class="section-subtext" style="margin-top: 16px;">
                            Vytvořeno: ${formatCreatedAt(trip.created_at)}
                        </p>
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
                .order("created_at", { ascending: false });

            if (requestVersion !== tripsLoadVersion) {
                return;
            }

            if (!currentUser) {
                setLoggedOutTripsState();
                return;
            }

            if (error) {
                emptyTripsState.classList.remove("hidden");
                emptyTripsState.innerHTML = `
                    <h3>Nepodařilo se načíst cesty</h3>
                    <p>${error.message}</p>
                `;
                tripsList.classList.add("hidden");
                tripsList.innerHTML = "";
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

            emptyTripsState.classList.remove("hidden");
            emptyTripsState.innerHTML = `
                <h3>Nepodařilo se načíst cesty</h3>
                <p>${error.message}</p>
            `;
            tripsList.classList.add("hidden");
            tripsList.innerHTML = "";
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

        // Okamžitě zneplatníme staré requesty a schováme tripy,
        // aby se nic starého nemohlo vrátit do UI.
        currentUser = null;
        invalidateTripsRequests();
        updateAuthUI();
        setLoggedOutTripsState();

        try {
            const { error } = await supabaseClient.auth.signOut();

            if (error) {
                await syncCurrentUserFromSession();
                updateAuthUI();
                await loadMyTrips();
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
            } else {
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
                    guide_included: guideIncluded
                };

                const { error: insertError } = await supabaseClient
                    .from("trips")
                    .insert([tripPayload]);

                if (insertError) {
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
                alert("Chyba při ukládání tripu: " + error.message);
            }
        });
    }

    // =======================
    // INIT
    // =======================

    updateSummary();
    await refreshAuthAndTrips();

    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
        currentUser = session?.user ?? null;

        if (!currentUser) {
            invalidateTripsRequests();
            updateAuthUI();
            setLoggedOutTripsState();
            return;
        }

        updateAuthUI();
        await loadMyTrips();
    });
});