(function() {
    var SLOT_TIMEOUT_MINUTES = 15; 

    // ১. Remove করার মেইন ফাংশন
    window.removeSlotFromBooking = async function(slotId) {
        var index = selectedSlotsForBooking.indexOf(slotId);
        if (index !== -1) { selectedSlotsForBooking.splice(index, 1); }
        for (var i = myBookedSlots.length - 1; i >= 0; i--) {
            if (myBookedSlots[i].id === slotId) { myBookedSlots.splice(i, 1); }
        }
        try { 
            await db.collection('classSlots').doc(slotId).update({ 
                status: 'available', bookedBy: firebase.firestore.FieldValue.delete(), 
                bookedByName: firebase.firestore.FieldValue.delete(), bookedByUniqueId: firebase.firestore.FieldValue.delete(), 
                bookedAt: firebase.firestore.FieldValue.delete(), pendingOrderId: firebase.firestore.FieldValue.delete(),
                reservedAt: firebase.firestore.FieldValue.delete() 
            }); 
            renderAvailableSlots();
            showToast('🗑️ Slot removed', 'info'); 
        } catch (e) { showToast('❌ Failed to remove slot', 'error'); }
    };

    // ২. সিলেক্ট করার ফাংশন 
    window.toggleSlotSelection = async function(slotId) {
        if (currentStudent && currentStudent.studentCode) { showToast('⛔ আপনার স্লট অলরেডি বুক করা আছে!', 'error'); return; }
        var index = selectedSlotsForBooking.indexOf(slotId);
        if (index !== -1) { removeSlotFromBooking(slotId); return; }
        if (selectedSlotsForBooking.length >= 2) { showToast('⚠️ আপনি সর্বোচ্চ ২টি স্লট সিলেক্ট করতে পারবেন', 'error'); return; }
        var newSlot = availableSlotsCache.find(function(s) { return s.id === slotId; });
        if (!newSlot || newSlot.status !== 'available') { showToast('⚠️ এই স্লটটি এখন আর খালি নেই', 'error'); return; }
        for (var i = 0; i < selectedSlotsForBooking.length; i++) {
            var ex = availableSlotsCache.find(function(s) { return s.id === selectedSlotsForBooking[i]; });
            if (ex && ex.dayOfWeek === newSlot.dayOfWeek) { showToast('⚠️ আপনি একই দিনে (Same day) দুটি স্লট সিলেক্ট করতে পারবেন না!', 'error'); return; }
        }
        try {
            await db.collection('classSlots').doc(slotId).update({ 
                status: 'pending', bookedBy: currentStudent.id, bookedByName: currentStudent.name || '', 
                bookedByUniqueId: currentStudent.uniqueId || '', bookedAt: firebase.firestore.FieldValue.serverTimestamp(), 
                reservedAt: Date.now(), pendingOrderId: '' 
            });
            selectedSlotsForBooking.push(slotId); 
            if (newSlot) { newSlot.status = 'pending'; newSlot.bookedBy = currentStudent.id; newSlot.reservedAt = Date.now(); if (!myBookedSlots.find(function(x){ return x.id === slotId; })) { myBookedSlots.push(newSlot); } }
            showToast('✅ Slot selected (15 min time limit)', 'success'); renderAvailableSlots();
        } catch (e) { showToast('❌ ' + e.message, 'error'); }
    };

    // ৩. UI রেন্ডার 
    window.renderAvailableSlots = function() {
        var list = document.getElementById('availableSlotsList'); var myBanner = document.getElementById('myUpcomingSlotBanner'); var selectedBanner = document.getElementById('selectedSlotsBanner');
        if (!list) return;
        if (currentStudent && currentStudent.studentCode) {
            if (myBanner) myBanner.classList.add('hidden'); if (selectedBanner) selectedBanner.classList.add('hidden');
            list.innerHTML = '<div class="pro-card p-8 text-center border-2 border-red-300 bg-red-50"><p class="text-5xl mb-3">⛔</p><p class="text-red-800 font-black text-lg">Access Denied!</p><p class="text-sm text-red-700 mt-2 font-bold">আপনার Student Code অলরেডি অ্যাসাইন করা আছে।</p><p class="text-[12px] text-slate-600 mt-1">আপনার ক্লাসের স্লট আগেই বুক করা হয়েছে। নতুন করে স্লট সিলেক্ট করার প্রয়োজন নেই।</p></div>';
            return;
        }
        var mySlots = myBookedSlots.filter(function(s) { return s.status === 'booked' || (s.status === 'pending' && !selectedSlotsForBooking.includes(s.id)); });
        if (myBanner) {
            if (mySlots.length > 0) {
                var bhtml = '<div class="flex items-start gap-3"><div class="text-3xl">📌</div><div class="flex-1"><p class="text-[11px] font-black text-green-900 uppercase mb-1">Booked / Pending Slots</p>';
                mySlots.forEach(function(s) { bhtml += '<p class="text-[12px] font-bold text-green-800 mt-1">📅 ' + (s.dayOfWeek || '') + ' · ⏰ ' + formatTimeAMPM(s.startTime) + '–' + formatTimeAMPM(s.endTime) + '</p>'; });
                bhtml += '</div></div>'; myBanner.innerHTML = bhtml; myBanner.classList.remove('hidden');
            } else { myBanner.classList.add('hidden'); }
        }
        if (selectedBanner) {
            if (selectedSlotsForBooking.length > 0) {
                var sHtml = '<div class="flex items-start gap-3"><div class="text-3xl">☑️</div><div class="flex-1"><p class="text-[11px] font-black text-green-900 uppercase mb-2">Slots Selected for this Plan</p>';
                selectedSlotsForBooking.forEach(function(sId) {
                    var slot = availableSlotsCache.find(function(s) { return s.id === sId; });
                    if (slot) {
                        sHtml += '<div class="flex items-center justify-between bg-white p-2.5 rounded-xl mb-2 border border-green-300 shadow-sm"><div class="flex-1"><p class="text-[13px] font-black text-green-900">📅 ' + slot.dayOfWeek + '</p><p class="text-[11px] text-slate-600 font-bold">⏰ ' + formatTimeAMPM(slot.startTime) + ' – ' + formatTimeAMPM(slot.endTime) + '</p></div>';
                        sHtml += '<button onclick="removeSlotFromBooking(\'' + slot.id + '\')" class="ml-2 bg-red-100 text-red-700 text-[11px] font-black px-3.5 py-2 rounded-lg hover:bg-red-200 transition">❌ Remove</button></div>';
                    }
                });
                sHtml += '</div></div>'; selectedBanner.innerHTML = sHtml; selectedBanner.classList.remove('hidden');
            } else { selectedBanner.classList.add('hidden'); }
        }
        var filtered = availableSlotsCache.filter(function(s) { return s.status === 'available'; });
        var dayOrder = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6, Sunday: 7 };
        filtered.sort(function(a, b) { return (dayOrder[a.dayOfWeek] || 99) - (dayOrder[b.dayOfWeek] || 99); });
        if (filtered.length === 0) { list.innerHTML = '<div class="pro-card p-6 text-center border-2 border-slate-200"><p class="text-3xl mb-2">📭</p><p class="text-slate-600 font-bold text-sm">No available slots.</p></div>'; return; }
        list.innerHTML = '';
        filtered.forEach(function(s) {
            var isSel = selectedSlotsForBooking.indexOf(s.id) !== -1;
            var div = document.createElement('div');
            div.className = 'border-2 rounded-2xl p-4 transition-all ' + (isSel ? 'bg-green-50 border-green-500' : 'bg-white border-cyan-300 hover:shadow-lg');
            div.innerHTML = '<div class="flex justify-between items-start gap-3 flex-wrap mb-2"><div class="min-w-0 flex-1"><p class="font-black text-cyan-900 text-sm">📅 ' + (s.dayOfWeek || '—') + '</p><p class="text-[11px] text-slate-600 font-bold mt-0.5">⏰ ' + formatTimeAMPM(s.startTime) + ' – ' + formatTimeAMPM(s.endTime) + '</p><p class="text-[10px] text-slate-500 mt-1">📘 ' + (s.subCategoryDisplay || '—') + '</p></div><button type="button" onclick="toggleSlotSelection(\'' + s.id + '\')" class="' + (isSel ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-700') + ' font-bold text-xs px-4 py-2 rounded-xl transition-all">' + (isSel ? '✅ Selected' : '➕ Select') + '</button></div>';
            list.appendChild(div);
        });
    };

    // ৪. লিসেনার আপডেট
    window.startSlotsListener = function() {
        if (!currentStudent || !currentStudent.id) return;
        if (slotsUnsubscribe) slotsUnsubscribe();
        slotsUnsubscribe = db.collection('classSlots').onSnapshot(function(snap) {
            availableSlotsCache = []; myBookedSlots = []; var now = Date.now(); var timeoutMs = SLOT_TIMEOUT_MINUTES * 60 * 1000;
            snap.forEach(function(doc) {
                var s = Object.assign({ id: doc.id }, doc.data());
                if (s.status === 'pending' && s.bookedBy === currentStudent.id) {
                    if (!s.reservedAt || (now - s.reservedAt > timeoutMs)) {
                        db.collection('classSlots').doc(s.id).update({ status: 'available', bookedBy: firebase.firestore.FieldValue.delete(), bookedByName: firebase.firestore.FieldValue.delete(), bookedByUniqueId: firebase.firestore.FieldValue.delete(), bookedAt: firebase.firestore.FieldValue.delete(), pendingOrderId: firebase.firestore.FieldValue.delete(), reservedAt: firebase.firestore.FieldValue.delete() });
                        s.status = 'available'; s.bookedBy = null; s.reservedAt = null;
                    }
                }
                availableSlotsCache.push(s);
                if (s.bookedBy === currentStudent.id && s.status === 'pending') myBookedSlots.push(s);
            });
            if (currentStudent.studentCode) {
                var bookSlotBtn = document.getElementById('bookSlotBtn'); if (bookSlotBtn) bookSlotBtn.classList.add('hidden'); 
                var view = document.getElementById('view-slots'); if (view && !view.classList.contains('hidden')) { renderAvailableSlots(); }
            } else {
                var bookSlotBtn2 = document.getElementById('bookSlotBtn'); if (bookSlotBtn2) bookSlotBtn2.classList.remove('hidden');
                var view2 = document.getElementById('view-slots'); if (view2 && !view2.classList.contains('hidden')) { renderAvailableSlots(); }
            }
        }, function(err) { console.warn('Slots listener:', err.message); });
    };

    // ৫. কুপন ও অফার লিসেনার
    window.loadOfferConfig = function() {
        db.collection('coupons').onSnapshot(function(snap) {
            coupons = {};
            snap.forEach(function(d) {
                var c = d.data();
                if (c.active !== false && c.code) coupons[c.code.toUpperCase().trim()] = Object.assign({}, c, { _id: d.id });
            });

            if (appliedCoupons.length > 0) {
                var removedAny = false;
                for (var i = appliedCoupons.length - 1; i >= 0; i--) {
                    var appliedCode = appliedCoupons[i].code;
                    var activeCoupon = coupons[appliedCode];
                    if (!activeCoupon || activeCoupon.active === false) {
                        appliedCoupons.splice(i, 1);
                        removedAny = true;
                        showToast('⚠️ কুপনটি অ্যাডমিন কর্তৃক বাতিল করা হয়েছে!', 'error');
                    }
                }
                if (removedAny) {
                    saveSelectedPlan();
                    if (typeof renderCheckoutCoupons === 'function') renderCheckoutCoupons();
                    if (typeof renderCheckoutSavings === 'function') renderCheckoutSavings();
                    if (typeof renderCheckoutSummary === 'function') renderCheckoutSummary();
                    updatePaymentPageUI();
                }
            }

            var modal = document.getElementById('planCheckoutModal');
            if (modal && !modal.classList.contains('hidden')) {
                if (typeof renderCheckoutCoupons === 'function') renderCheckoutCoupons();
                if (typeof renderCheckoutSavings === 'function') renderCheckoutSavings();
                if (typeof renderCheckoutSummary === 'function') renderCheckoutSummary();
            }
        });

        db.collection('config').doc('offer').onSnapshot(function(offerDoc) {
            if (!offerDoc.exists) { offerConfig = null; renderDynamicPlans(); return; }
            var data = offerDoc.data() || {};
            offerConfig = data;
            window.currentOffer = data;

            var oop = data.oneOnOnePricing || {};
            var gp = data.groupPricing || {};

            pricing = {
                oneOnOneAdmission: { regular: Number(oop.admissionRegular) || 0, discounted: Number(oop.admissionDiscounted) || 0, special: Number(oop.admissionSpecial) || 0 },
                oneOnOneCourses: oop.courses || {},
                groupAdmissionRegular: Number(gp.regularAdmission) || 2500,
                groupAdmissionDiscounted: Number(gp.discountedAdmission) || 2000,
                groupAdmissionSpecial: Number(gp.specialAdmission) || 1500
            };

            dynamicCategories = {
                oneOnOne: (data.categories && data.categories.oneOnOne) ? data.categories.oneOnOne : {},
                group: (data.categories && data.categories.group) ? data.categories.group : {}
            };

            updateOfferDeadline();
            if (offerDeadline > Date.now() && offerExpiredHandled) offerExpiredHandled = false;
            renderDynamicPlans();
            tickTimer();

            var modal = document.getElementById('planCheckoutModal');
            if (modal && !modal.classList.contains('hidden') && selectedPlan) {
                renderCheckoutPlanCard('#1d4ed8', '#1e40af');
                if (typeof renderCheckoutCoupons === 'function') renderCheckoutCoupons();
                if (typeof renderCheckoutSavings === 'function') renderCheckoutSavings();
                if (typeof renderCheckoutSummary === 'function') renderCheckoutSummary();
            }
        }, function(err) { console.error('Offer listener error:', err); });

        startTimer();
    };

    // ৬. দাম ক্যালকুলেশন
    window.calculateSelectedPlanPricing = function() {
        if (!selectedPlan) return null;
        var plan = selectedPlan.plan;
        var active = isOfferActive();
        var days = Number(plan.days) || 0;
        var isOneOnOne = selectedPlan.category === 'oneOnOne';

        var regularRate, discountedRate, specialRate;
        var regularTotal, discountedTotal, specialTotal;
        var admissionFee = 0;

        if (isOneOnOne) {
            regularRate = Number(selectedPlan.courseRegular) || 0;
            discountedRate = Number(selectedPlan.courseDiscounted) || regularRate;
            specialRate = Number(selectedPlan.courseSpecial) || discountedRate;
            regularTotal = regularRate; discountedTotal = discountedRate; specialTotal = specialRate;
            if (active) admissionFee = Number(selectedPlan.admissionFeeSpecial) || 0;
            else admissionFee = Number(selectedPlan.admissionFeeDiscounted) || Number(selectedPlan.admissionFeeRegular) || 0;
        } else {
            regularTotal = Number(plan.regularTotal) || Number(plan.regularRate) || 0;
            discountedTotal = Number(plan.discountedTotal) || Number(plan.discountedRate) || regularTotal;
            specialTotal = Number(plan.specialTotal) || Number(plan.specialRate) || discountedTotal;
            regularRate = days > 0 ? Math.round(regularTotal / days) : regularTotal;
            discountedRate = days > 0 ? Math.round(discountedTotal / days) : discountedTotal;
            specialRate = days > 0 ? Math.round(specialTotal / days) : specialTotal;
            admissionFee = Number(selectedPlan.groupAdmissionFee) || 0;
        }

        var coursePrice = active ? specialTotal : discountedTotal;
        var subtotal = admissionFee + coursePrice;
        var builtInSave = regularTotal - coursePrice;

        var couponDisc = 0;
        var usedCoupons = [];
        if (hasCouponAccess() && appliedCoupons.length > 0) {
            appliedCoupons.forEach(function(c) {
                var cc = c.category || c.appliesTo;
                var matchesCat = (selectedPlan.category === 'oneOnOne' && cc === 'oneOnOne') || (selectedPlan.category === 'group' && cc === 'group');
                if (!matchesCat) return;
                if (c.allowedPlans && c.allowedPlans.length > 0) {
                    var monthsCheck = Math.round(days / 30);
                    if (c.allowedPlans.indexOf(days + 'd') === -1 && c.allowedPlans.indexOf(monthsCheck + 'm') === -1) return;
                }
                var disc = c.type === 'percent' ? Math.round(subtotal * c.value / 100) : c.value;
                couponDisc += disc;
                usedCoupons.push({ code: c.code, type: c.type, value: c.value, disc: disc });
            });
        }
        couponDisc = Math.min(couponDisc, subtotal);

        var final = Math.max(0, subtotal - couponDisc);
        var totalSave = builtInSave + couponDisc;

        return {
            planPrice: coursePrice, coursePrice: coursePrice, admissionFee: admissionFee,
            subtotal: subtotal, currentRate: active ? specialRate : discountedRate,
            regularTotal: regularTotal, discountedTotal: discountedTotal, specialTotal: specialTotal,
            couponDisc: couponDisc, usedCoupons: usedCoupons, final: final, totalSave: totalSave,
            active: active, days: days, regularRate: regularRate, discountedRate: discountedRate,
            specialRate: specialRate, builtInSave: builtInSave
        };
    };

    // 🎯 ৭. পেমেন্ট পেজ আপডেট করার কমন ফাংশন
    function updatePaymentPageUI() {
        if (currentPayStep >= 1 && currentPayStep <= 4 && selectedPlan) {
            var p = calculateSelectedPlanPricing();
            if (p) {
                var planDisplayName = getPlanDisplayName();
                var isOneOnOne = selectedPlan.category === 'oneOnOne';
                var lines = '';
                
                if (isOneOnOne) {
                    lines = 'Admission: ' + money(p.admissionFee) + ' | Course: ' + money(p.coursePrice);
                    if (p.couponDisc > 0) lines += ' | Coupons: −' + money(p.couponDisc);
                } else {
                    if (p.admissionFee > 0) lines = 'Admission: ' + money(p.admissionFee) + ' | Package: ' + money(p.planPrice);
                    else lines = 'Package: ' + money(p.planPrice);
                    if (p.couponDisc > 0) lines += ' | Coupons: −' + money(p.couponDisc);
                }
                
                if(document.getElementById('payPlanName')) document.getElementById('payPlanName').textContent = '📘 ' + planDisplayName;
                if(document.getElementById('payLines')) document.getElementById('payLines').textContent = lines;
                if(document.getElementById('payAmount')) document.getElementById('payAmount').textContent = money(p.final);
                if(document.getElementById('payStep4Amount')) document.getElementById('payStep4Amount').textContent = money(p.final);
                if(document.getElementById('payStep4Plan')) document.getElementById('payStep4Plan').textContent = planDisplayName;
            }
        }
    }

    // ৮. পেমেন্ট পেজে যাওয়া
    window.proceedToPayment = function() {
        if (!selectedPlan) { alert('⚠️ Please select a plan.'); return; }
        updatePaymentPageUI(); // এখানে কমন ফাংশন কল করলাম
        
        screenshotBase64 = null; payDoneChecked = false; payMethodSelected = ''; screenshotCheckChecked = false;
        document.getElementById('previewBox').classList.add('hidden');
        document.getElementById('screenshotInput').value = '';
        document.getElementById('thankYouBox').classList.add('hidden');
        document.getElementById('screenshotWarning').classList.add('hidden');
        document.querySelectorAll('.pay-method-radio').forEach(function(r) { r.checked = false; });
        document.querySelectorAll('.checklist-item').forEach(function(el) { el.classList.remove('checked'); });
        document.getElementById('payDoneRadio').checked = false;
        document.getElementById('screenshotAttachRadio').checked = false;
        document.getElementById('stage1NextBtn').disabled = true;
        document.getElementById('stage2NextBtn').disabled = true;
        document.getElementById('stage3NextBtn').disabled = true;
        
        document.getElementById('payStep4Name').textContent = currentStudent.name || '—';
        document.getElementById('payStep4Uid').textContent = currentStudent.uniqueId || '—';
        document.getElementById('payStep4Method').textContent = '—';
        document.getElementById('payStep4Screenshot').textContent = '—';
        currentPayStep = 1;
        showView('payment');
        renderPayStage();
    };

    // ৯. Payment Submit 
    window.submitPurchase = async function() {
        if (!screenshotBase64) { alert('⚠️ Upload screenshot!'); return; }
        if (!selectedPlan) { alert('⚠️ Plan missing.'); return; }
        var p = calculateSelectedPlanPricing(); var planDisplayName = getPlanDisplayName(); var cleanPlan = cleanPlanName(planDisplayName); var payMethod = payMethodSelected || 'Google Pay';
        var submitBtn = document.getElementById('paySubmitBtn'); submitBtn.disabled = true; submitBtn.textContent = '⏳ Submitting...';
        var orderId = 'ES-' + Date.now().toString().slice(-8) + '-' + Math.floor(Math.random() * 900 + 100);
        var appliedCouponData = p.usedCoupons.map(function(uc) { var orig = appliedCoupons.filter(function(c) { return c.code === uc.code; })[0]; return { code: uc.code, type: uc.type, value: uc.value, discount: uc.disc, appliesTo: orig ? (orig.category || orig.appliesTo) : null }; });
        var isOneOnOne = selectedPlan.category === 'oneOnOne'; var months = isOneOnOne ? Math.round((selectedPlan.plan.days || 0) / 30) : null;
        var selectedSlotsData = isOneOnOne ? (selectedPlan.selectedSlots || []).map(function(slotId) { var s = availableSlotsCache.find(function(x) { return x.id === slotId; }); return s ? { id: s.id, dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime, approvalStatus: 'pending' } : { id: slotId, approvalStatus: 'pending' }; }) : [];
        var order = {
            orderId: orderId, studentId: currentStudent.id, studentName: currentStudent.name, studentUniqueId: currentStudent.uniqueId || '', studentCode: currentStudent.studentCode || '', courseEnrolled: currentStudent.courseEnrolled || '', batchName: currentStudent.batchName || '', planName: planDisplayName, planCategory: selectedPlan.category, planSubCategoryDisplay: selectedPlan.subCategoryDisplay, planSubCategoryId: selectedPlan.subCategoryId, planDays: selectedPlan.plan.days, planIndex: selectedPlan.planIndex, planType: isOneOnOne ? 'oneOnOne_complete' : 'group_classes', classes: isOneOnOne ? (selectedPlan.classes || 0) : selectedPlan.plan.days, duration: isOneOnOne ? (selectedPlan.duration || '') : '', platform: isOneOnOne ? (selectedPlan.platform || '') : '', facilities: isOneOnOne ? (selectedPlan.facilities || []) : [], months: months, selectedSlots: selectedSlotsData, slotApprovalStatus: (isOneOnOne && selectedSlotsData.length > 0) ? 'pending' : 'not_applicable', regularTotal: p.regularTotal, isNewStudent: selectedPlan.isNewStudent || false, isRenewal: isExistingStudent, baseAmount: p.subtotal, originalAmount: p.admissionFee + p.regularTotal, admissionFee: p.admissionFee, courseFee: p.coursePrice, subtotal: p.subtotal, monthlyFee: p.coursePrice, couponCode: appliedCoupons.length > 0 ? appliedCoupons.map(function(c) { return c.code; }).join(',') : null, appliedCoupons: appliedCouponData, totalDiscount: p.couponDisc, finalAmount: p.final, paymentMethod: payMethod, screenshot: screenshotBase64, status: 'pending', createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        try {
            await db.collection('purchases').add(order);
            if (isOneOnOne && selectedSlotsData.length > 0) {
                for (var si = 0; si < selectedSlotsData.length; si++) {
                    try { await db.collection('classSlots').doc(selectedSlotsData[si].id).update({ status: 'pending', pendingOrderId: orderId, bookedBy: currentStudent.id, bookedByName: currentStudent.name || '', bookedByUniqueId: currentStudent.uniqueId || '', bookedAt: firebase.firestore.FieldValue.serverTimestamp(), reservedAt: firebase.firestore.FieldValue.delete() }); } catch (e) {}
                }
            }
            logActivity('purchase_placed', { orderId: orderId, planName: planDisplayName, amount: p.final });
            try { var link = document.createElement('a'); link.href = screenshotBase64; link.download = orderId + '.jpg'; link.click(); } catch (e) {}
            var breakdown = ''; if (p.admissionFee > 0) breakdown += '• Admission: ' + money(p.admissionFee) + '\n'; breakdown += '• Course: ' + money(p.coursePrice) + '\n• Subtotal: ' + money(p.subtotal) + '\n'; p.usedCoupons.forEach(function(uc) { breakdown += '• Coupon ' + uc.code + ': −' + money(uc.disc) + '\n'; }); breakdown += '• Net: ' + money(p.final);
            var slotInfo = ''; if (selectedSlotsData.length > 0) { slotInfo = '\n--- SLOTS (Pending Approval) ---\n'; selectedSlotsData.forEach(function(s) { slotInfo += '• ' + s.dayOfWeek + ' — ' + formatTimeAMPM(s.startTime) + ' to ' + formatTimeAMPM(s.endTime) + '\n'; }); }
            var msg = '✅ PAYMENT COMPLETED — English Spur\n\n🆔 ORDER ID: ' + orderId + '\n\nName: ' + currentStudent.name + '\nUnique ID: ' + (currentStudent.uniqueId || '—') + '\n' + (currentStudent.studentCode ? 'Code: ' + currentStudent.studentCode + '\n' : '') + '\nPLAN: ' + cleanPlan + slotInfo + '\nFEE:\n' + breakdown + '\n\nNet Amount: ' + money(p.final) + '\n\nMethod: ' + payMethod + '\n\nKindly verify 🙏';
            window.open('https://wa.me/' + PHONE + '?text=' + encodeURIComponent(msg), '_blank');
            document.getElementById('stage5OrderId').textContent = orderId; selectedPlan = null; selectedSlotsForBooking = []; appliedCoupons = []; saveSelectedPlan();
            [1, 2, 3, 4, 5].forEach(function(n) { var el = document.getElementById('payStep' + n); if (el) el.classList.add('hidden'); }); currentPayStep = 5; renderPayStage();
            setTimeout(function() { var tyb = document.getElementById('thankYouBox'); tyb.classList.remove('hidden'); tyb.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 350);
        } catch (err) { alert('❌ ' + err.message); submitBtn.disabled = false; submitBtn.textContent = '✅ Submit'; }
    };

    // ১০. History
    window.loadHistory = function() {
        var hBadge = document.getElementById('historyBadge'); if (hBadge) hBadge.classList.add('hidden'); var aBadge = document.getElementById('actionBadge'); if (aBadge) aBadge.classList.add('hidden');
        if (!currentStudent) return; var list = document.getElementById('historyList'); list.innerHTML = '<p class="text-center text-slate-500 py-6 text-sm">🔄 Loading...</p>';
        db.collection('purchases').where('studentId', '==', currentStudent.id).onSnapshot(function(snap) {
            list.innerHTML = '';
            if (snap.empty) { list.innerHTML = '<div class="text-center py-10 bg-slate-50 rounded-2xl"><p class="text-3xl mb-2">📭</p><p class="text-slate-600 font-bold text-sm">No orders yet.</p></div>'; return; }
            var items = []; snap.forEach(function(d) { items.push(Object.assign({ id: d.id }, d.data())); }); items.sort(function(a, b) { var ta = a.createdAt ? a.createdAt.toDate().getTime() : 0; var tb = b.createdAt ? b.createdAt.toDate().getTime() : 0; return tb - ta; });
            items.forEach(function(p) {
                var colors = { pending: 'bg-gradient-to-br from-yellow-50 to-amber-50 text-yellow-800 border-yellow-300', approved: 'bg-gradient-to-br from-green-50 to-emerald-50 text-green-800 border-green-300', rejected: 'bg-gradient-to-br from-red-50 to-rose-50 text-red-800 border-red-300' };
                var badges = { pending: 'bg-yellow-500', approved: 'bg-green-600', rejected: 'bg-red-600' }; var icons = { pending: '⏳', approved: '✅', rejected: '❌' }; var statusText = { pending: 'PENDING', approved: 'APPROVED', rejected: 'REJECTED' };
                var div = document.createElement('div'); div.className = 'border-2 rounded-2xl p-4 ' + (colors[p.status] || 'bg-slate-50 border-slate-200');
                var inner = '<div class="flex justify-between items-start gap-2 flex-wrap mb-2"><div class="flex-1 min-w-0"><p class="font-black text-xs sm:text-sm text-slate-800 truncate">' + (p.planName || '—') + '</p></div><span class="text-white text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ' + (badges[p.status] || '') + '">' + (icons[p.status] || '') + ' ' + (statusText[p.status] || '') + '</span></div>';
                inner += '<div class="bg-white rounded-xl p-3 mb-2 space-y-1.5">';
                inner += '<div class="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-xl px-3 py-2 mb-1"><span class="text-blue-700 font-black text-[10px] uppercase block">🆔 Order ID</span><strong class="text-blue-800 font-mono font-black text-[15px] tracking-widest">' + (p.orderId || '—') + '</strong></div>';
                inner += '<div class="flex justify-between text-[11px] gap-2"><span class="text-slate-500 font-semibold">📅 Date:</span><strong class="text-slate-700">' + formatFullTimestamp(p.createdAt) + '</strong></div>';
                if (p.selectedSlots && p.selectedSlots.length > 0) {
                    var slotApproval = p.slotApprovalStatus || (p.selectedSlots[0] && p.selectedSlots[0].approvalStatus) || 'pending';
                    var apprBadge, apprBoxCls;
                    if (slotApproval === 'approved' || p.status === 'approved') { apprBadge = '<span class="text-[9px] font-black bg-green-600 text-white px-2 py-0.5 rounded-full">✅ Slot Approved</span>'; apprBoxCls = 'bg-green-50 border-green-300'; }
                    else if (slotApproval === 'rejected') { apprBadge = '<span class="text-[9px] font-black bg-red-600 text-white px-2 py-0.5 rounded-full">❌ Slot Rejected</span>'; apprBoxCls = 'bg-red-50 border-red-300'; }
                    else { apprBadge = '<span class="text-[9px] font-black bg-amber-500 text-white px-2 py-0.5 rounded-full">⏳ Slot approval pending with admin</span>'; apprBoxCls = 'bg-amber-50 border-amber-300'; }
                    inner += '<div class="' + apprBoxCls + ' rounded-lg p-2 mt-1 border"><div class="flex items-center justify-between gap-2 mb-1 flex-wrap"><p class="text-[10px] text-slate-700 font-black uppercase">🗓️ Class Slots</p>' + apprBadge + '</div>';
                    p.selectedSlots.forEach(function(s) { inner += '<p class="text-[11px] text-slate-700 font-bold">📅 ' + (s.dayOfWeek || '') + ' · ⏰ ' + formatTimeAMPM(s.startTime) + '–' + formatTimeAMPM(s.endTime) + '</p>'; }); inner += '</div>';
                }
                if (p.admissionFee > 0) inner += '<div class="flex justify-between text-[11px] gap-2"><span class="text-slate-500 font-semibold">➕ Admission:</span><strong>' + money(p.admissionFee) + '</strong></div>';
                if (p.courseFee > 0) inner += '<div class="flex justify-between text-[11px] gap-2"><span class="text-slate-500 font-semibold">📘 Fee:</span><strong>' + money(p.courseFee) + '</strong></div>';
                inner += '<div class="flex justify-between text-[11px] gap-2"><span class="text-slate-500 font-semibold">💰 Net:</span><strong class="text-orange-600 text-sm">' + money(p.finalAmount) + '</strong></div>';
                if (p.paymentMethod) inner += '<div class="flex justify-between text-[11px] gap-2"><span class="text-slate-500 font-semibold">📱 UPI:</span><strong>' + p.paymentMethod + '</strong></div>';
                if (p.receiptNo) inner += '<div class="flex justify-between text-[11px] gap-2"><span class="text-slate-500 font-semibold">📄 PCS:</span><strong class="text-green-700">' + p.receiptNo + '</strong></div>';
                if (p.status === 'rejected' && p.rejectionReason) inner += '<div class="bg-red-50 border border-red-200 rounded-lg p-2 mt-1"><p class="text-[10px] text-red-700 font-bold">⚠️ Reason:</p><p class="text-[11px] text-red-800">' + p.rejectionReason + '</p></div>'; inner += '</div>';
                if (p.status === 'approved') inner += '<button type="button" onclick="viewReceipt(\'' + p.id + '\')" class="w-full bg-gradient-to-r from-blue-700 to-blue-800 text-white font-bold py-2.5 rounded-xl text-[11px] mb-2">📄 View Receipt</button>';
                if (p.status === 'rejected') inner += '<button type="button" onclick="openReuploadModal(\'' + p.id + '\'); return false;" class="w-full bg-gradient-to-r from-red-600 to-rose-600 text-white font-black py-3 rounded-xl text-[12px] mb-2">🔄 Re-upload</button>';
                div.innerHTML = inner; list.appendChild(div);
            });
        }, function(err) { list.innerHTML = '<p class="text-center text-red-500 py-6 text-sm">Error: ' + err.message + '</p>'; });
    };

    // ১১. রিয়েল-টাইম কুপন চেকার (১ সেকেন্ড পর পর)
    setInterval(function() {
        if (appliedCoupons.length > 0) {
            var removedAny = false;
            for (var i = appliedCoupons.length - 1; i >= 0; i--) {
                var appliedCode = appliedCoupons[i].code;
                var activeCoupon = coupons[appliedCode]; 
                if (!activeCoupon || activeCoupon.active === false) {
                    appliedCoupons.splice(i, 1);
                    removedAny = true;
                    showToast('⚠️ কুপনটি অ্যাডমিন কর্তৃক বাতিল করা হয়েছে!', 'error');
                }
            }
            if (removedAny) {
                saveSelectedPlan();
                if (typeof renderCheckoutCoupons === 'function') renderCheckoutCoupons();
                if (typeof renderCheckoutSavings === 'function') renderCheckoutSavings();
                if (typeof renderCheckoutSummary === 'function') renderCheckoutSummary();
                updatePaymentPageUI(); // 🎯 এখানে কল করা হলো
            }
        }
    }, 1000);

    // ১২. ইনিশিয়ালাইজ
    setTimeout(function() {
        var viewSlots = document.getElementById('view-slots');
        if (viewSlots && !document.getElementById('myUpcomingSlotBanner')) {
            var banner = document.createElement('div'); banner.id = 'myUpcomingSlotBanner'; banner.className = 'hidden bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-500 rounded-2xl p-4 mb-4';
            var sb = document.getElementById('selectedSlotsBanner'); if (sb && sb.parentNode) sb.parentNode.insertBefore(banner, sb); else viewSlots.appendChild(banner);
        }
        if (typeof db !== 'undefined' && typeof currentStudent !== 'undefined') {
            loadOfferConfig();
        }
    }, 1000);

    console.log('✅ Slot & Coupon System perfectly updated!');
})();