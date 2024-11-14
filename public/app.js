// app.js
// app.js
import { db } from './firebase-config.js';
import { collection, getDocs, query, where, limit } from 'https://www.gstatic.com/firebasejs/9.1.3/firebase-firestore.js';

import { getUnusedCode, moveCodeToAvailed } from './emailService.js'; // Remove sendConfirmationEmail import




// DOM Elements
const elements = {
    testList: document.getElementById('test-list'),
    testSearch: document.getElementById('test-search'),
    selectedTestsList: document.getElementById('selected-tests-list'),
    totalFeeElement: document.getElementById('total-fee'),
    form: document.getElementById('lab-test-form'),
    patientName: document.getElementById('patient-name'),
    phoneNumber: document.getElementById('phone-number'),
    email: document.getElementById('email')
};

// Add discount types
const DISCOUNTS = {
    TWENTY: 0.2,
    THIRTY: 0.3
};

// List of tests with 30% discount
const THIRTY_PERCENT_TESTS = [
    "Lipid Profile",
    "Serum 25-OH Vitamin D",
    "Glycosylated Hemoglobin (HbA1c)"
];

// Create discount filter buttons
const createDiscountFilters = () => {
    const filterContainer = document.createElement('div');
    filterContainer.className = 'discount-filters';
    
    filterContainer.innerHTML = `
        <button class="discount-filter" data-discount="all">All Tests</button>
        <button class="discount-filter" data-discount="20">20% Discount</button>
        <button class="discount-filter" data-discount="30">30% Discount</button>
    `;

    filterContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('discount-filter')) {
            const discount = e.target.dataset.discount;
            state.activeFilter = discount === 'all' ? null : discount;
            loadTests(); // Reload tests with filter
        }
    });

    // Insert before test list
    elements.testList.parentNode.insertBefore(filterContainer, elements.testList);
};

// Add filter state
const state = {
    selectedTests: new Set(),
    totalAmount: 0,
    activeFilter: null // null for all tests, '20' for 20%, '30' for 30%
};

// Update the formatCurrency function
const formatCurrency = (amount) => {
    // Convert to number if it's not already
    const numAmount = Number(amount);
    return `Rs.${isNaN(numAmount) ? 0 : numAmount.toFixed(2)}`;
};


const getAlphaNumericSortValue = (name) => {
    // Check if the test name starts with a letter
    const startsWithLetter = /^[a-zA-Z]/.test(name);
    // Return tuple: [priority, name] where priority is 0 for letters, 1 for others
    return [startsWithLetter ? 0 : 1, name.toLowerCase()];
};


const updateTotalAmount = () => {
    elements.totalFeeElement.textContent = formatCurrency(state.totalAmount);
};

const createTestCard = (test) => {
    // Determine discount percentage
    const isThirtyPercent = THIRTY_PERCENT_TESTS.includes(test.name);
    const discountPercentage = isThirtyPercent ? DISCOUNTS.THIRTY : DISCOUNTS.TWENTY;
    const discountLabel = isThirtyPercent ? '30%' : '20%';
    
    // Calculate prices
    const originalPrice = test.fee;
    const discountedPrice = originalPrice * (1 - discountPercentage);

    const card = document.createElement('div');
    card.className = 'test-card';
    card.dataset.discount = isThirtyPercent ? '30' : '20';
    
    card.innerHTML = `
        <div class="test-info">
            <span class="test-name">${test.name}</span>
            <span class="discount-badge">${discountLabel} OFF</span>
        </div>
        <div class="price-container">
            <span class="original-price">${formatCurrency(originalPrice)}</span>
            <span class="discounted-price">${formatCurrency(discountedPrice)}</span>
        </div>
    `;
    
    card.addEventListener('click', () => handleTestSelection({
        ...test,
        fee: discountedPrice,
        discountPercentage
    }));
    
    return card;
};

// Event Handlers
const handleTestSelection = (test) => {
    if (!state.selectedTests.has(test.id)) {
        state.selectedTests.add(test.id);
        state.totalAmount += test.fee;
        
        const li = document.createElement('li');
        li.className = 'selected-test';
        li.innerHTML = `
            <span>${test.name} - ${formatCurrency(test.fee)}</span>
            <button class="remove-test">✕</button>
        `;
        
        const removeBtn = li.querySelector('.remove-test');
        removeBtn.onclick = () => {
            state.selectedTests.delete(test.id);
            li.remove();
            state.totalAmount -= test.fee;
            updateTotalAmount();
        };
        
        elements.selectedTestsList.appendChild(li);
        updateTotalAmount();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    createDiscountFilters();
    loadTests();
});

const handleSearch = () => {
    const filter = elements.testSearch.value.toLowerCase();
    const cards = elements.testList.getElementsByClassName('test-card');
    
    Array.from(cards).forEach(card => {
        const testName = card.querySelector('.test-name').textContent.toLowerCase();
        card.style.display = testName.includes(filter) ? '' : 'none';
    });
};



const resetForm = () => {
    elements.form.reset();
    state.selectedTests.clear();
    elements.selectedTestsList.innerHTML = '';
    state.totalAmount = 0;
    updateTotalAmount();
};

// public/app.js
async function testFirestoreConnection() {
    try {
        const testQuery = query(
            collection(db, 'labs', 'chughtaiLab', 'tests'),
            where('isActive', '==', true),
            limit(1)
        );
        const snapshot = await getDocs(testQuery);
        if (!snapshot.empty) {
            console.log('Firestore connection successful. Test document:', snapshot.docs[0].data());
        } else {
            console.warn('Firestore connected but no active tests found.');
        }
    } catch (error) {
        console.error('Firestore connection error:', error);
    }
}

// Call the test function
testFirestoreConnection();

async function loadTests() {
    elements.testList.innerHTML = '<div class="loading-spinner"></div>';
    console.log('Loading tests from Firestore...');

    try {
        const testsRef = collection(db, 'labs', 'chughtaiLab', 'tests');
        const querySnapshot = await getDocs(testsRef);
        console.log(`Query Snapshot received with ${querySnapshot.size} documents.`);

        if (querySnapshot.empty) {
            console.warn('No tests found in Firestore.');
            elements.testList.innerHTML = '<p class="error">No tests found</p>';
            return;
        }

        const tests = [];
        window.testMap = {};

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            console.log(`Processing document ID: ${doc.id}`, data);
            
            // Check if required fields exist
            if (data.Name && data.Fees) {
                const test = {
                    id: doc.id,
                    name: data.Name,
                    fee: Number(data.Fees)
                };
                tests.push(test);
                testMap[doc.id] = test;
            }
        });

        console.log('All tests processed:', tests);

        // Sort and display tests (rest of your existing code)
        tests.sort((a, b) => {
            const [aPriority, aName] = getAlphaNumericSortValue(a.name);
            const [bPriority, bName] = getAlphaNumericSortValue(b.name);
            
            if (aPriority !== bPriority) {
                return aPriority - bPriority;
            }
            return aName.localeCompare(bName);
        });

        elements.testList.innerHTML = '';

        tests.forEach(test => {
            const card = createTestCard(test);
            if (state.activeFilter) {
                const isThirtyPercent = THIRTY_PERCENT_TESTS.includes(test.name);
                const cardDiscount = isThirtyPercent ? '30' : '20';
                if (cardDiscount === state.activeFilter) {
                    elements.testList.appendChild(card);
                }
            } else {
                elements.testList.appendChild(card);
            }
        });

    } catch (error) {
        console.error('Error loading tests:', error);
        elements.testList.innerHTML = '<p class="error">Error loading tests. Please try again later.</p>';
    }
}

const handleFormSubmit = async (e) => {
    e.preventDefault();
    
    try {
        // Validate selected tests
        if (state.selectedTests.size === 0) {
            alert('Please select at least one test');
            return;
        }

        // Get selected test names safely
        const selectedTestNames = Array.from(state.selectedTests)
            .map(id => testMap[id] ? testMap[id].name : 'Unknown Test')
            .join(', ');

        const formData = {
            name: elements.patientName.value.trim(),
            email: elements.email.value.trim(),
            phone: elements.phoneNumber.value.trim(),
            testName: selectedTestNames,
            testFee: state.totalAmount // Send the raw number
        };

        // Basic validation
        if (!formData.name || !formData.email || !formData.phone) {
            alert('Please fill out all required fields');
            return;
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            alert('Please enter a valid email address');
            return;
        }

        // Phone validation (Pakistan format)
        const phoneRegex = /^(\+92|0)?[0-9]{10}$/;
        if (!phoneRegex.test(formData.phone)) {
            alert('Please enter a valid phone number');
            return;
        }

        console.log('Getting unused code...');
        const codeInfo = await getUnusedCode();
        console.log('Retrieved code:', codeInfo);

        console.log('Moving code to availed...');
        await moveCodeToAvailed(codeInfo, {
            ...formData,
            testFee: formatCurrency(formData.testFee)
        });
        console.log('Code moved successfully');

        try {
            console.log('Sending confirmation email...');
            const emailResponse = await sendEmailToServer(formData, codeInfo);
            console.log('Email sent:', emailResponse);
            // Single success message
            alert('Booking confirmed! Please check your email for details.');
            
            // Reset form and selection state
            resetForm();
            state.selectedTests.clear();
            state.totalAmount = 0;
            updateTotalAmount();
            
            // Clear selected tests display
            elements.selectedTestsList.innerHTML = '';
            
        } catch (emailError) {
            console.error('Email sending failed:', emailError);
            alert('Booking confirmed but there was an error sending the email. Please contact support.');
        }

    } catch (error) {
        console.error('Error during booking process:', error);
        alert('An error occurred during the booking process. Please try again later.');
    }
};

const sendEmailToServer = async (formData, codeInfo) => {
    try {
        const params = new URLSearchParams({
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            testName: formData.testName,
            testFee: formData.testFee.toString(),
            discountCode: codeInfo.code
        });

        const response = await fetch(`/send-email?${params.toString()}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Server responded with error');
        }

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.message || 'Email sending failed');
        }

        return data;
    } catch (error) {
        console.error('Email server error:', error);
        throw new Error('Failed to send email. Please try again later.');
    }
};

// Event Listeners
elements.testSearch.addEventListener('input', handleSearch);
elements.form.addEventListener('submit', handleFormSubmit);

// Initialize the app
document.addEventListener('DOMContentLoaded', loadTests);