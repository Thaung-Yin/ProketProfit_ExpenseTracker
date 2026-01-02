// ==========================================
// 1. IMPORTS
// ==========================================
import { auth, db } from "./firebase.js"; 
import { onAuthStateChanged, signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { 
    collection, addDoc, deleteDoc, doc, getDoc, updateDoc, arrayUnion, arrayRemove, setDoc, 
    onSnapshot, query, orderBy, serverTimestamp, where, getDocs 
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// ==========================================
// 2. STATE & CONFIG
// ==========================================
let userProfile = { name: 'Loading...', id: '...', budget: 0 };
let dbData = { transactions: [], groups: [] };
let txType = 'expense';
let selBank = 'Cash';
let selCategory = 'Other'; 
let activeGroupId = null;
let currentUser = null;

let unsubPersonalTxs = null;
let unsubGroupTxs = null;

const banks = [
    { name: 'Cash', icon: 'fa-wallet', color: 'bg-gray-600', text: 'text-white' },
    { name: 'KBZPay', icon: 'fa-mobile-screen', color: 'bg-blue-600', text: 'text-white' },
    { name: 'WavePay', icon: 'fa-money-bill-wave', color: 'bg-yellow-400', text: 'text-gray-800' },
    { name: 'AYA Pay', icon: 'fa-credit-card', color: 'bg-red-600', text: 'text-white' },
    { name: 'CB Pay', icon: 'fa-building-columns', color: 'bg-orange-500', text: 'text-white' },
    { name: 'UAB Pay', icon: 'fa-wallet', color: 'bg-green-600', text: 'text-white' },
    { name: 'MytelPay', icon: 'fa-signal', color: 'bg-orange-600', text: 'text-white' },
    { name: 'OnePay', icon: 'fa-1', color: 'bg-blue-500', text: 'text-white' },
    { name: 'KBZ Bank', icon: 'fa-building', color: 'bg-blue-800', text: 'text-white' },
    { name: 'AYA Bank', icon: 'fa-building', color: 'bg-red-700', text: 'text-white' },
    { name: 'CB Bank', icon: 'fa-building', color: 'bg-orange-600', text: 'text-white' },
    { name: 'Yoma Bank', icon: 'fa-building', color: 'bg-red-800', text: 'text-white' },
    { name: 'A Bank', icon: 'fa-building', color: 'bg-yellow-500', text: 'text-white' },
    { name: 'AGD Bank', icon: 'fa-building', color: 'bg-green-700', text: 'text-white' },
    { name: 'MAB', icon: 'fa-landmark', color: 'bg-blue-400', text: 'text-white' },
    { name: 'UAB', icon: 'fa-landmark', color: 'bg-green-700', text: 'text-white' },
    { name: 'Citizens', icon: 'fa-users', color: 'bg-pink-600', text: 'text-white' },
    { name: 'MCB', icon: 'fa-building', color: 'bg-blue-300', text: 'text-gray-800' }
];

const categories = [
    { name: 'Food', icon: 'fa-utensils', color: 'bg-orange-100', text: 'text-orange-600' },
    { name: 'Transport', icon: 'fa-bus', color: 'bg-blue-100', text: 'text-blue-600' },
    { name: 'Shopping', icon: 'fa-bag-shopping', color: 'bg-pink-100', text: 'text-pink-600' },
    { name: 'Bills', icon: 'fa-file-invoice-dollar', color: 'bg-purple-100', text: 'text-purple-600' },
    { name: 'Entertainment', icon: 'fa-film', color: 'bg-yellow-100', text: 'text-yellow-600' },
    { name: 'Health', icon: 'fa-heart-pulse', color: 'bg-red-100', text: 'text-red-600' },
    { name: 'Education', icon: 'fa-graduation-cap', color: 'bg-indigo-100', text: 'text-indigo-600' },
    { name: 'Other', icon: 'fa-ellipsis', color: 'bg-gray-200', text: 'text-gray-600' }
];

// ==========================================
// 3. INITIALIZATION & LOGIN LOGIC
// ==========================================
window.onload = () => {
    const loader = document.getElementById('global-loader');

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            try {
                const docRef = doc(db, "users", user.uid);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    userProfile.name = data.fullname || user.displayName;
                    userProfile.id = data.shareID || "No ID";
                    userProfile.budget = data.monthlyBudget || 0; 
                } else {
                    const shareID = Math.floor(100000 + Math.random() * 900000).toString();
                    const newName = user.displayName || user.email.split('@')[0];
                    await setDoc(docRef, {
                        fullname: newName,
                        email: user.email,
                        uid: user.uid,
                        shareID: shareID,
                        createdAt: new Date(),
                        role: 'user',
                        monthlyBudget: 0
                    });
                    userProfile.name = newName;
                    userProfile.id = shareID;
                    userProfile.budget = 0;
                }
                updateProfileUI();
                initRealTimeListeners();
                populateReportDropdowns();
                router('dashboard');
                renderBankScroll();
                renderCategoryScroll(); 
                if(loader) setTimeout(() => loader.classList.add('hidden'), 500);
            } catch (e) {
                console.error("Error fetching profile:", e);
                if(loader) loader.classList.add('hidden');
            }
        } else {
            window.location.href = "./index.html";
        }
    });
};

function initRealTimeListeners() {
    const qGroups = query(collection(db, "groups"), where("members", "array-contains", userProfile.name));
    onSnapshot(qGroups, (snapshot) => {
        dbData.groups = [];
        const groupIds = [];
        snapshot.forEach((doc) => { 
            dbData.groups.push({ id: doc.id, ...doc.data() });
            groupIds.push(doc.id);
        });
        refreshUI();
        if(document.getElementById('view-group').classList.contains('block')) renderGroupList(); 
        setupTransactionListeners(groupIds);
    });
}

function setupTransactionListeners(groupIds) {
    let personalTxs = [];
    let groupTxs = [];

    const mergeAndRender = () => {
        const txMap = new Map();
        personalTxs.forEach(t => txMap.set(t.id, t));
        groupTxs.forEach(t => txMap.set(t.id, t));
        dbData.transactions = Array.from(txMap.values());
        refreshUI();
    };

    if(unsubPersonalTxs) unsubPersonalTxs();
    const qPersonal = query(collection(db, "transactions"), where("userId", "==", currentUser.uid), orderBy("date", "desc"));
    unsubPersonalTxs = onSnapshot(qPersonal, (snapshot) => {
        personalTxs = [];
        snapshot.forEach((doc) => { personalTxs.push({ id: doc.id, ...doc.data() }); });
        mergeAndRender();
    });

    if(unsubGroupTxs) unsubGroupTxs();
    if (groupIds.length > 0) {
        const safeGroupIds = groupIds.slice(0, 10);
        const qGroup = query(collection(db, "transactions"), where("groupId", "in", safeGroupIds));
        unsubGroupTxs = onSnapshot(qGroup, (snapshot) => {
            groupTxs = [];
            snapshot.forEach((doc) => { groupTxs.push({ id: doc.id, ...doc.data() }); });
            mergeAndRender();
        });
    } else {
        groupTxs = [];
        mergeAndRender();
    }
}

// ==========================================
// 5. GLOBAL ASSIGNMENTS
// ==========================================
window.router = router;
window.selectBank = selectBank;
window.selectCategory = selectCategory;
window.openModal = openModal;
window.closeModal = closeModal;
window.setTxType = setTxType;
window.toggleGroupSelect = toggleGroupSelect;
window.saveTx = saveTx;
window.showCreateGroup = showCreateGroup;
window.cancelCreateGroup = cancelCreateGroup;
window.createGroup = createGroup;
window.openGroupDetail = openGroupDetail;
window.closeGroupDetail = closeGroupDetail;
window.addMember = addMember;
window.removeMember = removeMember;
window.saveProfile = saveProfile;
window.togglePasswordForm = togglePasswordForm;
window.changeUserPassword = changeUserPassword;
window.logout = logout;
window.applyFilters = applyFilters;
window.downloadCSV = downloadCSV;
window.showSuccess = showSuccess;
window.showAlert = showAlert;
window.deleteTx = deleteTx;
window.deleteGroup = deleteGroup;
window.openBudgetModal = showBudgetModal;
window.closeBudgetModal = closeBudgetModal;
window.saveBudget = saveBudget;
window.openRenameModal = openRenameModal;
window.closeRenameModal = closeRenameModal;
window.saveGroupName = saveGroupName;

// ==========================================
// 6. MAIN LOGIC
// ==========================================
function refreshUI() {
    if(!document.getElementById('view-dashboard').classList.contains('hidden')) renderDashboard();
    if(!document.getElementById('view-income').classList.contains('hidden')) renderLists();
    if(!document.getElementById('view-expense').classList.contains('hidden')) renderLists();
    if(!document.getElementById('view-reports').classList.contains('hidden')) applyFilters();
    if(!document.getElementById('group-detail-view').classList.contains('hidden') && activeGroupId) {
        openGroupDetail(activeGroupId);
    }
}

async function saveTx() {
    const amt = document.getElementById('inp-amount').value;
    const desc = document.getElementById('inp-desc').value;
    const isGrp = document.getElementById('inp-is-group').checked;
    const grpId = isGrp ? document.getElementById('inp-group-select').value : null;
    
    if(!amt) { showAlert("Please fill in Amount."); return; }
    
    let finalDesc = desc;
    if (txType === 'expense' && !desc) {
        if(selCategory === 'Other') { showAlert("Please add a Note for 'Other'."); return; }
        finalDesc = selCategory; 
    } else if (!desc) {
        showAlert("Please fill in Note.");
        return;
    }

    try {
        await addDoc(collection(db, "transactions"), {
            type: txType,
            amount: parseFloat(amt),
            bank: selBank,
            category: txType === 'expense' ? selCategory : 'Income', 
            desc: finalDesc,
            date: new Date().toISOString().split('T')[0],
            createdAt: serverTimestamp(),
            groupId: grpId,
            userId: currentUser.uid,
            userName: userProfile.name // <--- ADDED: Save User Name for Group History
        });
        closeModal();
        document.getElementById('inp-amount').value = '';
        document.getElementById('inp-desc').value = '';
        setTimeout(() => { showSuccess(txType === 'income' ? "Income Added!" : "Expense Added!"); }, 300);
    } catch (e) {
        console.error("Error adding doc: ", e);
        showAlert("Error: " + e.message);
    }
}

// ------------------------------------
// BUDGET & GROUP LOGIC
// ------------------------------------
let budgetMode = 'user'; 

function showBudgetModal(mode) {
    budgetMode = mode;
    const modalTitle = document.getElementById('budget-modal-title');
    const input = document.getElementById('inp-budget-edit');
    const modal = document.getElementById('budget-modal');

    if (mode === 'user') {
        modalTitle.innerText = "Set Monthly Budget";
        input.value = userProfile.budget || '';
    } else {
        const g = dbData.groups.find(x => x.id === activeGroupId);
        if (!g) return;
        modalTitle.innerText = `Budget for ${g.name}`;
        input.value = g.monthlyBudget || '';
    }
    
    modal.classList.remove('hidden');
    input.focus();
}
function closeBudgetModal() { document.getElementById('budget-modal').classList.add('hidden'); }
async function saveBudget() {
    const val = document.getElementById('inp-budget-edit').value;
    const newBudget = val ? parseFloat(val) : 0;
    try {
        if (budgetMode === 'user') {
            const userRef = doc(db, "users", currentUser.uid);
            await updateDoc(userRef, { monthlyBudget: newBudget });
            userProfile.budget = newBudget;
            renderDashboard(); 
            showSuccess("Personal Budget Updated!");
        } else {
            if (!activeGroupId) return;
            const groupRef = doc(db, "groups", activeGroupId);
            await updateDoc(groupRef, { monthlyBudget: newBudget });
            showSuccess("Group Budget Updated!");
        }
        closeBudgetModal();
    } catch(e) { console.error(e); showAlert("Failed to save budget."); }
}
function openRenameModal() {
    const g = dbData.groups.find(x => x.id === activeGroupId);
    if (!g) return;
    document.getElementById('inp-rename-group').value = g.name;
    document.getElementById('rename-modal').classList.remove('hidden');
}
function closeRenameModal() { document.getElementById('rename-modal').classList.add('hidden'); }
async function saveGroupName() {
    const newName = document.getElementById('inp-rename-group').value.trim();
    if (!newName) { showAlert("Name cannot be empty."); return; }
    try {
        const groupRef = doc(db, "groups", activeGroupId);
        await updateDoc(groupRef, { name: newName });
        closeRenameModal();
        showSuccess("Group Renamed!");
    } catch(e) { console.error(e); showAlert("Failed to rename group."); }
}
async function saveProfile() {
    const newName = document.getElementById('settings-fullname').value.trim();
    if (!newName) { showAlert("Name cannot be empty."); return; }
    try {
        const userRef = doc(db, "users", currentUser.uid);
        await updateDoc(userRef, { fullname: newName });
        userProfile.name = newName;
        updateProfileUI();
        showSuccess("Profile Updated!");
    } catch (e) { console.error("Error updating profile:", e); showAlert("Failed to update profile."); }
}
function updateProfileUI() {
    const url = `https://ui-avatars.com/api/?name=${userProfile.name}&background=27386d&color=fff`;
    document.getElementById('header-avatar').src = url;
    document.getElementById('profile-img-lg').src = url;
    document.getElementById('header-name').innerText = userProfile.name;
    document.getElementById('profile-name').innerText = userProfile.name;
    document.getElementById('settings-fullname').value = userProfile.name;
    document.getElementById('settings-userid').value = userProfile.id;
}
function togglePasswordForm() {
    const form = document.getElementById('password-form-container');
    const btn = document.getElementById('btn-toggle-pw');
    if (form.classList.contains('hidden')) { form.classList.remove('hidden'); btn.classList.add('hidden'); } 
    else { form.classList.add('hidden'); btn.classList.remove('hidden'); }
}
async function changeUserPassword() {
    const oldPass = document.getElementById('old-password').value;
    const newPass = document.getElementById('new-password').value;
    const verifyPass = document.getElementById('verify-password').value;
    if (!oldPass || !newPass || !verifyPass) { showAlert("Fill all fields."); return; }
    if (newPass !== verifyPass) { showAlert("Passwords mismatch."); return; }
    if (newPass.length < 6) { showAlert("Password too short."); return; }
    try {
        const credential = EmailAuthProvider.credential(currentUser.email, oldPass);
        await reauthenticateWithCredential(currentUser, credential);
        await updatePassword(currentUser, newPass);
        showSuccess("Password Updated!"); togglePasswordForm(); 
    } catch (error) { showAlert("Error: " + error.message); }
}
async function createGroup() {
    const name = document.getElementById('new-group-name').value;
    const budget = document.getElementById('new-group-budget').value;
    if(name) {
        try {
            await addDoc(collection(db, "groups"), {
                name: name,
                members: [userProfile.name],
                ownerId: currentUser.uid,
                monthlyBudget: budget ? parseFloat(budget) : 0,
                shareIncome: document.getElementById('create-share-inc').checked,
                shareExpense: document.getElementById('create-share-exp').checked,
                createdAt: serverTimestamp()
            });
            document.getElementById('new-group-name').value = ''; 
            document.getElementById('new-group-budget').value = '';
            cancelCreateGroup();
            setTimeout(() => { showSuccess("Group Created!"); }, 300);
        } catch (e) { showAlert("Could not create group."); }
    } else { showAlert("Enter group name."); }
}
async function deleteTx(id) {
    if(confirm("Delete this transaction?")) { try { await deleteDoc(doc(db, "transactions", id)); showSuccess("Deleted"); } catch (e) { showAlert("Failed."); } } 
}
async function deleteGroup(id) {
    if(confirm("Delete this group?")) { try { await deleteDoc(doc(db, "groups", id)); closeGroupDetail(); showSuccess("Deleted"); } catch (e) { showAlert("Failed."); } } 
}

// ==========================================
// 7. UI RENDERERS
// ==========================================
function router(page) {
    document.querySelectorAll('.view-section').forEach(el => { el.classList.remove('block'); el.classList.add('hidden'); });
    const target = document.getElementById('view-' + page);
    if(target) { target.classList.remove('hidden'); target.classList.add('block'); }
    document.querySelectorAll('[id^="nav-d-"]').forEach(el => el.classList.remove('bg-brand', 'text-white', 'shadow-lg'));
    const dNav = document.getElementById('nav-d-' + (page==='menu'?'dashboard':page)); 
    if(dNav) dNav.classList.add('bg-brand', 'text-white', 'shadow-lg');
    document.querySelectorAll('[id^="nav-m-"]').forEach(el => el.classList.replace('text-brand', 'text-gray-400'));
    const mNav = document.getElementById('nav-m-' + page);
    if(mNav) mNav.classList.replace('text-gray-400', 'text-brand');
    const titleEl = document.getElementById('page-title');
    if(titleEl) titleEl.innerText = page.charAt(0).toUpperCase() + page.slice(1);
    refreshUI();
    if(page === 'group') renderGroupList();
    if(page === 'reports') applyFilters(); 
}

function renderDashboard() {
    let bal = 0, inc = 0, exp = 0;
    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7); 
    let monthlyExp = 0;

    // Filter ONLY personal transactions for the Dashboard logic
    const myTxs = dbData.transactions.filter(t => t.userId === currentUser.uid);

    if(myTxs) {
        myTxs.forEach(t => {
            if(t.type === 'income') { bal += t.amount; inc += t.amount; }
            else { 
                bal -= t.amount; 
                exp += t.amount; 
                if(t.date && t.date.startsWith(currentMonth)) monthlyExp += t.amount;
            }
        });
    }

    document.getElementById('dash-balance').innerText = bal.toLocaleString() + ' MMK';
    document.getElementById('dash-income-card').innerText = inc.toLocaleString() + ' MMK';
    document.getElementById('dash-expense-card').innerText = exp.toLocaleString() + ' MMK';

    const limit = userProfile.budget || 0;
    const spentEl = document.getElementById('dash-spent-month');
    const limitEl = document.getElementById('dash-budget-limit');
    const bar = document.getElementById('dash-budget-bar');
    const pctEl = document.getElementById('dash-budget-pct');

    if(spentEl) spentEl.innerText = monthlyExp.toLocaleString();
    
    if(limit > 0 && limitEl) {
        limitEl.innerText = limit.toLocaleString();
        const pct = Math.min((monthlyExp / limit) * 100, 100);
        pctEl.innerText = Math.round((monthlyExp / limit) * 100) + '%';
        bar.style.width = pct + '%';
        bar.className = "h-full rounded-full transition-all duration-500 ";
        if(pct < 50) bar.classList.add('bg-green-500');
        else if(pct < 80) bar.classList.add('bg-yellow-400');
        else bar.classList.add('bg-red-500');
    } else if(limitEl) {
        limitEl.innerText = "No Limit";
        pctEl.innerText = "N/A";
        bar.style.width = '0%';
    }

    const glist = document.getElementById('dash-groups-list');
    if(glist) {
        glist.innerHTML = '';
        if(!dbData.groups || dbData.groups.length === 0) {
            glist.innerHTML = '<p class="text-xs text-gray-400 text-center py-4">No groups yet.</p>';
        } else {
            dbData.groups.slice(0,3).forEach(g => {
                const gExp = dbData.transactions.filter(t => t.groupId === g.id && t.type==='expense').reduce((s,t)=>s+t.amount,0);
                glist.innerHTML += `<div class="flex justify-between items-center p-3 bg-gray-50 rounded-xl mb-2 cursor-pointer hover:bg-gray-100 transition" onclick="router('group');openGroupDetail('${g.id}')"><div><p class="text-sm font-bold text-gray-700">${g.name}</p><p class="text-[10px] text-gray-400">Total Spent: ${gExp.toLocaleString()}</p></div><i class="fa-solid fa-chevron-right text-gray-300 text-xs"></i></div>`;
            });
        }
    }

    const tbody = document.getElementById('dash-recent-table');
    tbody.innerHTML = '';
    
    // Only show MY transactions in Recent Activity
    if(myTxs && myTxs.length > 0) {
        const sorted = [...myTxs].sort((a,b) => new Date(b.date) - new Date(a.date));
        sorted.slice(0,5).forEach(t => {
            const catObj = categories.find(c => c.name === t.category) || { color: 'bg-gray-100', text: 'text-gray-500' };
            const catBadge = t.type === 'income' 
                ? `<span class="bg-green-100 text-green-600 text-[10px] px-2 py-1 rounded font-bold">INCOME</span>`
                : `<span class="${catObj.color} ${catObj.text} text-[10px] px-2 py-1 rounded font-bold flex items-center gap-1 w-fit"><i class="fa-solid ${catObj.icon} text-[9px]"></i>${t.category || 'Expense'}</span>`;
            
            tbody.innerHTML += `<tr class="hover:bg-gray-50 transition border-b border-gray-50 last:border-0"><td class="p-4 font-bold text-gray-700 text-sm">${t.desc}</td><td class="p-4">${catBadge}</td><td class="p-4 text-xs text-gray-400 whitespace-nowrap">${t.date}</td><td class="p-4 text-right font-bold text-sm ${t.type==='income'?'text-green-600':'text-red-600'}">${t.amount.toLocaleString()}</td></tr>`;
        });
    } else { tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-gray-400 text-xs">No transactions found</td></tr>'; }
    
    renderChart(inc, exp, myTxs);
}

function renderLists() {
    ['income', 'expense'].forEach(type => {
        const list = document.getElementById(type + '-list');
        const totalEl = document.getElementById(type + '-total');
        if(!list) return;
        list.innerHTML = '';
        
        // Filter only MY transactions for these lists
        const filtered = dbData.transactions.filter(t => t.type === type && t.userId === currentUser.uid);
        
        const total = filtered.reduce((acc, t) => acc + t.amount, 0);
        totalEl.innerText = total.toLocaleString() + ' MMK';
        if(filtered.length === 0) { list.innerHTML = '<p class="text-center text-gray-400 text-sm py-4">No records yet.</p>'; return; }
        filtered.sort((a,b) => new Date(b.date) - new Date(a.date)).forEach(t => {
            const grpName = t.groupId ? dbData.groups.find(g => g.id === t.groupId)?.name : null;
            const groupBadge = grpName ? `<div class="text-[10px] bg-brand/10 text-brand px-2 py-1 rounded mt-1 w-fit"><i class="fa-solid fa-users mr-1"></i>${grpName}</div>` : ''; 
            
            let iconClass = type === 'income' ? 'fa-arrow-down' : 'fa-arrow-up';
            let bgClass = type === 'income' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600';
            if (type === 'expense' && t.category) {
                 const cat = categories.find(c => c.name === t.category);
                 if(cat) { iconClass = cat.icon; bgClass = cat.color + ' ' + cat.text; }
            }
            list.innerHTML += `<div class="flex justify-between items-center p-4 bg-white rounded-2xl border border-gray-100 shadow-sm group"><div class="flex items-center gap-4"><div class="w-10 h-10 rounded-full ${bgClass} flex items-center justify-center"><i class="fa-solid ${iconClass}"></i></div><div><p class="font-bold text-gray-800">${t.desc}</p><p class="text-xs text-gray-400">${t.date} • ${t.bank}</p>${groupBadge}</div></div><div class="flex items-center gap-3"><span class="font-bold ${type==='income'?'text-green-600':'text-red-600'}">${t.amount.toLocaleString()}</span><button onclick="deleteTx('${t.id}')" class="w-8 h-8 flex items-center justify-center rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 transition"><i class="fa-solid fa-trash text-xs"></i></button></div></div>`;
        });
    });
}

function renderChart(inc, exp, myTxs) {
    const ctx = document.getElementById('mainChart').getContext('2d');
    if(window.myChart) window.myChart.destroy();
    let labels = []; let dataPoints = []; let bgColors = [];
    
    // Use only personal transactions
    const safeTxs = myTxs || dbData.transactions.filter(t => t.userId === currentUser.uid);
    const expenseTxs = safeTxs.filter(t => t.type === 'expense');

    if (expenseTxs.length > 0) {
        const catMap = {};
        expenseTxs.forEach(t => {
            const cat = t.category || 'Other';
            if(!catMap[cat]) catMap[cat] = 0;
            catMap[cat] += t.amount;
        });
        labels = Object.keys(catMap);
        dataPoints = Object.values(catMap);
        bgColors = labels.map(l => {
            const cObj = categories.find(c => c.name === l);
            if(!cObj) return '#9ca3af'; 
            if(cObj.name === 'Food') return '#fb923c'; 
            if(cObj.name === 'Transport') return '#3b82f6'; 
            if(cObj.name === 'Shopping') return '#ec4899'; 
            if(cObj.name === 'Bills') return '#a855f7'; 
            if(cObj.name === 'Entertainment') return '#eab308'; 
            if(cObj.name === 'Health') return '#ef4444'; 
            if(cObj.name === 'Education') return '#6366f1'; 
            return '#9ca3af';
        });
    } else {
        labels = ['Income', 'Expense']; dataPoints = [inc, exp]; bgColors = ['#22c55e', '#ef4444'];
        if(inc === 0 && exp === 0) { dataPoints = [1]; bgColors = ['#e5e7eb']; labels =['No Data']; }
    }
    window.myChart = new Chart(ctx, { 
        type: 'doughnut', 
        data: { labels: labels, datasets: [{ data: dataPoints, backgroundColor: bgColors, borderWidth: 0 }] }, 
        options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 } } } } } 
    });
}

function renderCategoryScroll() {
    const container = document.getElementById('category-scroll');
    if(!container) return;
    container.innerHTML = '';
    categories.forEach(c => {
        const isSelected = selCategory === c.name;
        container.innerHTML += `
            <div onclick="selectCategory('${c.name}')" class="flex flex-col items-center p-2 rounded-xl border cursor-pointer transition ${isSelected ? 'border-brand bg-brand/5 ring-1 ring-brand' : 'border-gray-100 bg-white hover:bg-gray-50'}">
                <div class="w-8 h-8 rounded-full ${c.color} ${c.text} flex items-center justify-center mb-1"><i class="fa-solid ${c.icon} text-xs"></i></div>
                <span class="text-[9px] font-bold text-gray-600">${c.name}</span>
            </div>`;
    });
}
function selectCategory(name) { selCategory = name; renderCategoryScroll(); if(name === 'Other') document.getElementById('inp-desc').focus(); }
function renderBankScroll() {
    const container = document.getElementById('bank-scroll');
    if(!container) return;
    container.innerHTML = '';
    banks.forEach(b => {
        container.innerHTML += `<div onclick="selectBank('${b.name}', this)" class="flex flex-col items-center justify-center p-3 rounded-2xl bg-gray-50 border border-gray-100 cursor-pointer transition hover:bg-white hover:shadow-md ${selBank === b.name ? 'ring-2 ring-brand ring-offset-2 bg-white shadow-md' : ''}"><div class="w-8 h-8 rounded-full ${b.color} ${b.text} flex items-center justify-center text-xs mb-2"><i class="fa-solid ${b.icon}"></i></div><span class="text-[10px] font-bold text-gray-600 text-center leading-tight truncate w-full">${b.name}</span></div>`;
    });
}
function selectBank(name, el) { selBank = name; renderBankScroll(); }
function setTxType(type) {
    txType = type;
    const bIn = document.getElementById('btn-tx-income');
    const bEx = document.getElementById('btn-tx-expense');
    const catSection = document.getElementById('category-section');
    if(type === 'expense') { 
        bEx.className = "flex-1 py-2 rounded-lg bg-white shadow-sm text-brand font-bold text-xs transition-all"; 
        bIn.className = "flex-1 py-2 rounded-lg text-gray-500 font-bold text-xs transition-all"; 
        if(catSection) catSection.classList.remove('hidden');
    } else { 
        bIn.className = "flex-1 py-2 rounded-lg bg-white shadow-sm text-brand font-bold text-xs transition-all"; 
        bEx.className = "flex-1 py-2 rounded-lg text-gray-500 font-bold text-xs transition-all";
        if(catSection) catSection.classList.add('hidden');
    }
}
function toggleGroupSelect() { 
    const isChecked = document.getElementById('inp-is-group').checked;
    const selectBox = document.getElementById('inp-group-select');
    isChecked ? selectBox.classList.remove('hidden') : selectBox.classList.add('hidden');
}
function openModal() {
    document.getElementById('tx-modal').classList.remove('hidden');
    renderBankScroll();
    selCategory = 'Other'; 
    renderCategoryScroll();
    const grpCont = document.getElementById('group-option-container');
    const sel = document.getElementById('inp-group-select');
    if(dbData.groups && dbData.groups.length > 0) {
        grpCont.classList.remove('hidden');
        sel.innerHTML = '';
        dbData.groups.forEach(g => { sel.innerHTML += `<option value="${g.id}">${g.name}</option>`; });
        document.getElementById('inp-is-group').checked = false;
        toggleGroupSelect();
    } else { grpCont.classList.add('hidden'); }
}
function closeModal() { document.getElementById('tx-modal').classList.add('hidden'); }
function showAlert(msg) { document.getElementById('alert-msg').innerText = msg; document.getElementById('modal-alert').classList.remove('hidden'); }
function showSuccess(msg) { document.getElementById('success-title').innerText = msg; document.getElementById('modal-success').classList.remove('hidden'); }

function renderGroupList() {
    const cont = document.getElementById('groups-container');
    cont.innerHTML = '';
    if(!dbData.groups || dbData.groups.length === 0) { cont.innerHTML = `<div class="col-span-full text-center py-10 text-gray-400">No groups yet. Create one to split bills!</div>`; return; }
    dbData.groups.forEach(g => {
        const gInc = dbData.transactions.filter(t => t.groupId === g.id && t.type==='income').reduce((s,t)=>s+t.amount,0);
        const gExp = dbData.transactions.filter(t => t.groupId === g.id && t.type==='expense').reduce((s,t)=>s+t.amount,0);
        const percent = (gExp + gInc) === 0 ? 0 : (gExp / (gExp+gInc)) * 100;
        cont.innerHTML += `<div onclick="openGroupDetail('${g.id}')" class="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition"><div class="flex justify-between mb-4"><h3 class="font-bold text-lg text-brandDark">${g.name}</h3><span class="text-xs bg-gray-100 px-2 py-1 rounded text-gray-500">${g.members.length} Members</span></div><div class="flex justify-between text-xs text-gray-500 mb-1"><span>Pot</span><span>Spent</span></div><div class="flex justify-between font-bold text-lg mb-2"><span class="text-green-500">${gInc.toLocaleString()}</span><span class="text-red-500">${gExp.toLocaleString()}</span></div><div class="w-full bg-gray-100 h-1.5 rounded-full"><div class="bg-brand h-1.5 rounded-full" style="width: ${percent}%"></div></div></div>`;
    });
}
function showCreateGroup() { document.getElementById('group-list-view').classList.add('hidden'); document.getElementById('group-create-view').classList.remove('hidden'); }
function cancelCreateGroup() { document.getElementById('group-create-view').classList.add('hidden'); document.getElementById('group-list-view').classList.remove('hidden'); }

function openGroupDetail(id) {
    activeGroupId = id;
    const g = dbData.groups.find(x => x.id === id);
    if(!g) return;
    document.getElementById('group-list-view').classList.add('hidden');
    document.getElementById('group-detail-view').classList.remove('hidden');
    document.getElementById('detail-group-name').innerText = g.name;
    document.getElementById('detail-group-id').innerText = g.id.slice(0,6);
    let btnContainer = document.querySelector('#group-detail-view .bg-brand');
    let existingDelBtn = document.getElementById('btn-delete-group');
    if(existingDelBtn) existingDelBtn.remove();
    const renameBtn = document.getElementById('btn-rename-group');
    const budgetBtn = document.getElementById('btn-edit-group-budget');
    if (currentUser.uid === g.ownerId) {
        if(renameBtn) renameBtn.classList.remove('hidden');
        if(budgetBtn) budgetBtn.classList.remove('hidden');
        let delBtn = document.createElement('button');
        delBtn.id = 'btn-delete-group';
        delBtn.className = "absolute top-4 right-4 bg-white/20 hover:bg-red-500 hover:text-white text-white p-2 rounded-lg backdrop-blur-md transition";
        delBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
        delBtn.onclick = (e) => { e.stopPropagation(); deleteGroup(id); };
        btnContainer.appendChild(delBtn);
    } else {
        if(renameBtn) renameBtn.classList.add('hidden');
        if(budgetBtn) budgetBtn.classList.add('hidden');
    }

    const gInc = dbData.transactions.filter(t => t.groupId === id && t.type==='income').reduce((s,t)=>s+t.amount,0);
    const gExp = dbData.transactions.filter(t => t.groupId === id && t.type==='expense').reduce((s,t)=>s+t.amount,0);
    document.getElementById('detail-group-inc').innerText = gInc.toLocaleString();
    document.getElementById('detail-group-exp').innerText = gExp.toLocaleString();
    
    const bar = document.getElementById('group-budget-bar');
    const status = document.getElementById('group-budget-status');
    const limit = g.monthlyBudget || 0;
    if(limit > 0) {
        const pct = Math.min((gExp / limit) * 100, 100);
        status.innerText = `${gExp.toLocaleString()} / ${limit.toLocaleString()}`;
        bar.style.width = pct + '%';
        bar.className = "h-full rounded-full transition-all ";
        if(pct < 50) bar.classList.add('bg-green-500'); else if(pct < 80) bar.classList.add('bg-yellow-400'); else bar.classList.add('bg-red-500');
    } else { status.innerText = "No Limit"; bar.style.width = '0%'; }

    const txList = document.getElementById('detail-tx-list');
    txList.innerHTML = '';
    const groupTxs = dbData.transactions.filter(t => t.groupId === id);
    if(groupTxs.length === 0) txList.innerHTML = '<p class="text-xs text-center text-gray-400 py-4">No transactions yet.</p>';
    groupTxs.sort((a,b) => new Date(b.date) - new Date(a.date));

    groupTxs.forEach(t => {
        const isMe = t.userId === currentUser.uid;
        
        // --- ADDED: Show actual name if available, else "Member"
        const payerText = isMe ? "Paid by You" : `Paid by ${t.userName || 'Member'}`;

        console.log(payerText);

        txList.innerHTML += `<div class="flex justify-between items-center p-3 border-b border-gray-50"><div><p class="text-xs font-bold text-gray-700">${t.desc}</p><p class="text-[10px] text-gray-400">${payerText}</p></div><div class="flex items-center gap-3"><span class="text-xs font-bold ${t.type==='income'?'text-green-600':'text-red-600'}">${t.amount.toLocaleString()}</span>${isMe ? `<button onclick="deleteTx('${t.id}')" class="text-gray-300 hover:text-red-500 transition"><i class="fa-solid fa-trash text-xs"></i></button>` : ''}</div></div>`;
    });
    
    const mList = document.getElementById('detail-member-list');
    mList.innerHTML = '';
    const members = g.members || [];
    members.forEach(m => { 
        let removeBtnHTML = '';
        if (currentUser.uid === g.ownerId && m !== userProfile.name) {
            removeBtnHTML = `<button onclick="removeMember('${m}')" class="text-gray-300 hover:text-red-500 transition ml-auto"><i class="fa-solid fa-times"></i></button>`;
        }
        mList.innerHTML += `<div class="p-3 bg-gray-50 rounded-xl flex items-center gap-3"><div class="w-8 h-8 rounded-full bg-brand text-white flex items-center justify-center font-bold text-xs">${m[0] || 'U'}</div><span class="text-sm font-bold">${m}</span>${removeBtnHTML}</div>`; 
    });
}
function closeGroupDetail() { document.getElementById('group-detail-view').classList.add('hidden'); document.getElementById('group-list-view').classList.remove('hidden'); renderGroupList(); }
async function addMember() {
    const inputEl = document.getElementById('add-member-input');
    const inputVal = inputEl.value.trim();
    if (!inputVal) { showAlert("Enter name or ID."); return; }
    if (!activeGroupId) { showAlert("No active group."); return; }
    try {
        const currentGroup = dbData.groups.find(g => g.id === activeGroupId);
        if (currentGroup && currentGroup.members.some(m => m.toLowerCase() === inputVal.toLowerCase())) { showAlert("User is already in group."); return; }
        const qId = query(collection(db, "users"), where("shareID", "==", inputVal));
        const snapId = await getDocs(qId);
        let foundUser = null;
        if (!snapId.empty) { foundUser = snapId.docs[0].data(); } 
        else {
            const qName = query(collection(db, "users"), where("fullname", "==", inputVal));
            const snapName = await getDocs(qName);
            if(!snapName.empty) foundUser = snapName.docs[0].data();
        }
        if (foundUser) {
            const groupRef = doc(db, "groups", activeGroupId);
            await updateDoc(groupRef, { members: arrayUnion(foundUser.fullname) });
            showSuccess(`Added ${foundUser.fullname}!`);
            inputEl.value = ''; 
        } else { showAlert("User not found. Check ID/Name."); }
    } catch (e) { console.error("Member Search Error:", e); showAlert("Error searching user."); }
}
async function removeMember(memberName) {
    if(!confirm(`Remove ${memberName} from group?`)) return;
    try {
        const groupRef = doc(db, "groups", activeGroupId);
        await updateDoc(groupRef, { members: arrayRemove(memberName) });
        showSuccess("Member Removed");
    } catch (e) { console.error(e); showAlert("Failed to remove member."); }
}
function logout() { signOut(auth).then(() => { showAlert("Logged out. Redirecting..."); setTimeout(()=> { window.location.href = "./index.html"; }, 1000); }); }
function populateReportDropdowns() {
    const catSel = document.getElementById('filter-category');
    if(!catSel) return;
    catSel.innerHTML = '<option value="all">All Categories</option>';
    categories.forEach(c => { catSel.innerHTML += `<option value="${c.name}">${c.name}</option>`; });
}
function applyFilters() {
    const month = document.getElementById('filter-month').value;
    const cat = document.getElementById('filter-category').value;
    const type = document.getElementById('filter-type').value;
    const tbody = document.getElementById('report-table-body');
    tbody.innerHTML = '';
    
    // Filter only MY transactions for Reports too
    if(dbData.transactions && dbData.transactions.length > 0) {
        const filtered = dbData.transactions.filter(t => {
            const isMine = t.userId === currentUser.uid;
            const txMonth = t.date ? t.date.split('-')[1] : null;
            const matchMonth = month === 'all' || (txMonth === month);
            const matchCat = cat === 'all' || t.category === cat;
            const matchType = type === 'all' || t.type === type;
            return isMine && matchMonth && matchCat && matchType;
        });

        if(filtered.length === 0) { tbody.innerHTML = '<tr><td colspan="4" class="p-5 text-center text-gray-400 text-xs">No results match filters.</td></tr>'; return; }
        filtered.sort((a,b) => new Date(b.date) - new Date(a.date)).forEach(t => {
            tbody.innerHTML += `<tr class="hover:bg-gray-50 transition border-b border-gray-50 last:border-0"><td class="p-5 text-gray-500 text-xs">${t.date}</td><td class="p-5"><span class="px-2 py-1 rounded text-[10px] font-bold uppercase ${t.type==='income'?'bg-green-100 text-green-600':'bg-red-100 text-red-600'}">${t.type}</span></td><td class="p-5 font-bold text-gray-700">${t.desc} <span class="block text-[10px] text-gray-400 font-normal">${t.bank} • ${t.category||'General'}</span></td><td class="p-5 text-right font-bold ${t.type==='income'?'text-green-600':'text-red-600'}">${t.amount.toLocaleString()}</td></tr>`;
        });
    } else { tbody.innerHTML = '<tr><td colspan="4" class="p-5 text-center text-gray-400 text-xs">No transactions.</td></tr>'; }
}
function downloadCSV() {
    // Download only MY data
    const myTxs = dbData.transactions.filter(t => t.userId === currentUser.uid);
    if(!myTxs || myTxs.length === 0) { showAlert("No data."); return; }
    let csv = "Date,Type,Category,Description,Bank,Group,Amount\n";
    myTxs.forEach(t => { csv += `${t.date},${t.type},${t.category || ''},${t.desc},${t.bank},${t.groupId||''},${t.amount}\n`; });
    const link = document.createElement("a");
    link.href = "data:text/csv;charset=utf-8," + encodeURI(csv);
    link.download = "proket_data.csv";
    link.click();
}