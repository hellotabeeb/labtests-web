// emailService.js

import { collection, getDocs, query, where, writeBatch, doc, limit } from 'https://www.gstatic.com/firebasejs/9.1.3/firebase-firestore.js';
import { db } from './firebase-config.js';

export async function getUnusedCode() {
    const requestId = Date.now();
    console.log('[Debug] Starting getUnusedCode function');

    try {
        // Reference to codes collection
        const codesRef = collection(db, 'codes');
        console.log('[Debug] Obtained collection reference for "codes"');

        // Create query for isUsed == 'false'
        const codesQuery = query(
            codesRef,
            where('isUsed', '==', 'false'),
            limit(1)
        );
        console.log('[Debug] Created query for isUsed == "false"');

        // Execute query
        const snapshot = await getDocs(codesQuery);
        console.log('[Debug] Query executed. Snapshot empty?:', snapshot.empty);

        if (snapshot.empty) {
            console.error('[Code Request Failed]', { 
                requestId, 
                error: 'No unused codes available',
                timestamp: new Date().toISOString()
            });
            throw new Error('No discount codes available');
        }

        // Log retrieved documents
        snapshot.forEach(doc => {
            console.log('[Debug] Found document:', {
                id: doc.id,
                data: doc.data()
            });
        });

        const docData = snapshot.docs[0].data();
        const docId = snapshot.docs[0].id;

        console.log('[Debug] Successfully found code:', {
            docId,
            code: docData.code,
            isUsed: docData.isUsed
        });

        return {
            code: docData.code,
            docId: docId
        };
    } catch (error) {
        console.error('[Debug] Error in getUnusedCode:', {
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
        throw error;
    }
}

// emailService.js

export async function moveCodeToAvailed(codeInfo, bookingDetails) {
    console.log('[Debug] Starting moveCodeToAvailed with:', { codeInfo });
    
    const batch = writeBatch(db);

    try {
        // Reference to availedCodes collection
        const availedCodesRef = collection(db, 'availedCodes');

        const availedCodeData = {
            code: codeInfo.code,
            userName: bookingDetails.name,
            userEmail: bookingDetails.email,
            userPhone: bookingDetails.phone,
            testName: bookingDetails.testName,
            testFee: bookingDetails.testFee,
            availedAt: new Date().toISOString()
        };

        // Add to availedCodes
        const newAvailedRef = doc(availedCodesRef);
        batch.set(newAvailedRef, availedCodeData);

        // Update original code with isUsed as string
        const codeRef = doc(db, 'codes', codeInfo.docId);
        batch.update(codeRef, { 
            isUsed: 'true', 
            usedAt: new Date().toISOString() 
        });

        console.log('[Debug] Committing batch write');
        await batch.commit();
        console.log('[Debug] Batch write successful');

        return true;
    } catch (error) {
        console.error('[Debug] Error in moveCodeToAvailed:', {
            message: error.message,
            stack: error.stack,
            codeInfo: codeInfo
        });
        throw error;
    }
}