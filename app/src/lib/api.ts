import { pb } from '$lib/pocketbase';
import { goto } from '$app/navigation';
import { generateUUID } from '$lib/utils';

export async function createKimpay(name: string, icon: string, creatorName: string, otherParticipants: string[] = []) {
  try {
    const invite_token = generateUUID();
    
    // 1. Create Kimpay (Updated with icon and created_by placeholder)
    const kimpayRecord = await pb.collection('kimpays').create({
      name,
      icon,
      invite_token,
      // We will update created_by AFTER creating the participant because we need the participant ID
    });

    // 2. Create Creator Participant
    const creatorRecord = await pb.collection('participants').create({
      name: creatorName,
      kimpay: kimpayRecord.id,
      local_id: generateUUID() // Generate a local ID for the creator
    });
    
    // 2b. Update Kimpay with created_by
    await pb.collection('kimpays').update(kimpayRecord.id, {
        created_by: creatorRecord.id
    });

    // 3. Save Creator's Local ID to LocalStorage (Browser only)
    if (typeof localStorage !== 'undefined') {
        const key = `kimpay_user_${kimpayRecord.id}`;
        localStorage.setItem(key, creatorRecord.local_id);

        const myKimpays = JSON.parse(localStorage.getItem('my_kimpays') || "{}");
        myKimpays[kimpayRecord.id] = creatorRecord.id;
        localStorage.setItem('my_kimpays', JSON.stringify(myKimpays));
    }

    // 4. Create Other Participants
    for (const participantName of otherParticipants) {
      if (!participantName.trim()) continue;
      await pb.collection('participants').create({
        name: participantName,
        kimpay: kimpayRecord.id,
        // No local_id for others yet, they will "claim" it or it stays empty
      });
    }

    return kimpayRecord;
  } catch (error) {
    console.error("Failed to create kimpay", error);
    throw error;
  }
}

export async function deleteKimpay(id: string) {
    // Delete the Kimpay. PocketBase cascade delete should handle expenses and participants if configured in schema.
    // Based on schema, 'expenses' has cascadeDelete: true on kimpay relation.
    // 'participants' also has cascadeDelete: true on kimpay relation.
    await pb.collection('kimpays').delete(id);
}

export async function addParticipant(kimpayId: string, name: string) {
    return await pb.collection('participants').create({
        name,
        kimpay: kimpayId
    });
}

export async function updateKimpay(id: string, data: { name?: string; icon?: string }) {
    return await pb.collection('kimpays').update(id, data);
}

export async function deleteExpense(id: string) {
    try {
        const expense = await pb.collection('expenses').getOne(id);
        await pb.collection('expenses').delete(id);
        
        // Touch the kimpay to trigger realtime update for other users
        if (expense.kimpay) {
            await pb.collection('kimpays').update(expense.kimpay, { updated: new Date() });
        }
    } catch (e) {
        console.error("Error deleting expense", e);
        throw e;
    }
}

export async function createReimbursement(kimpayId: string, fromId: string, toId: string, amount: number) {
    const data = {
        kimpay: kimpayId,
        description: "Reimbursement", // or "Remboursement" depending on language preference, sticking to generic/english or hardcoded
        amount: amount,
        date: new Date().toISOString().split('T')[0],
        payer: fromId,
        involved: [toId],
        created_by: fromId 
    };
    return await pb.collection('expenses').create(data);
}
