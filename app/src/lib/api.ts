import { pb } from '$lib/pocketbase';
import { goto } from '$app/navigation';
import { generateUUID } from '$lib/utils';
import { REIMBURSEMENT_EMOJI } from '$lib/constants';

export async function createKimpay(name: string, icon: string, creatorName: string, otherParticipants: string[] = []) {
  try {
    const invite_token = generateUUID();
    
    // 1. Create Kimpay (Updated with icon and created_by placeholder)
    const kimpayRecord = await pb.collection('kimpays').create({
      name,
      icon,
      invite_token,
      // We will update created_by AFTER creating the participant because we need the participant ID
    }, { requestKey: null });

    // 2. Create Creator Participant
    const creatorRecord = await pb.collection('participants').create({
      name: creatorName,
      kimpay: kimpayRecord.id,
      local_id: generateUUID() // Generate a local ID for the creator
    }, { requestKey: null });
    
    // 2b. Update Kimpay with created_by
    await pb.collection('kimpays').update(kimpayRecord.id, {
        created_by: creatorRecord.id
    }, { requestKey: null });

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
      }, { requestKey: null });
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
    await pb.collection('kimpays').delete(id, { requestKey: null });
}

export async function addParticipant(kimpayId: string, name: string) {
    return await pb.collection('participants').create({
        name,
        kimpay: kimpayId
    }, { requestKey: null });
}

export async function updateKimpay(id: string, data: { name?: string; icon?: string }) {
    return await pb.collection('kimpays').update(id, data, { requestKey: null });
}

export async function deleteExpense(id: string) {
    try {
        const expense = await pb.collection('expenses').getOne(id, { requestKey: null });
        await pb.collection('expenses').delete(id, { requestKey: null });
        
        // Touch the kimpay to trigger realtime update for other users
        if (expense.kimpay) {
            await pb.collection('kimpays').update(expense.kimpay, { updated: new Date() }, { requestKey: null });
        }
    } catch (e) {
        console.error("Error deleting expense", e);
        throw e;
    }
}

export async function createReimbursement(kimpayId: string, fromId: string, toId: string, amount: number, description: string = "Reimbursement") {
    const data = {
        kimpay: kimpayId,
        description: description,
        amount: amount,
        date: new Date().toISOString().split('T')[0],
        payer: fromId,
        involved: [toId],
        created_by: fromId,
        is_reimbursement: true,
        icon: REIMBURSEMENT_EMOJI
    };
    return await pb.collection('expenses').create(data, { requestKey: null });
}

export async function updateParticipant(id: string, data: Partial<{ name: string; avatar: File | null }>) {
    return await pb.collection('participants').update(id, data, { requestKey: null });
}
