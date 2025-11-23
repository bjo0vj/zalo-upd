module.exports.config = {
    name: "logEvt",
    event_type: ["group_event", "undo", "message", "reaction"],
    version: "1.0.0",
    author: "NLam182 ",
    description: "Lắng nghe và ghi lại sự kiện ra console một cách rõ ràng."
};

module.exports.run = async function({ api, event, eventType }) {
    try {
        const eventDataString = JSON.stringify(event, null, 2);
        console.log(`\n--- [ BẮT ĐẦU  ] ---`);
        console.log(`🔔 Loại event: ${eventType.toUpperCase()}`);
        console.log(`📝 Dữ liệu chi tiết:`);
        console.log(eventDataString);
        
        console.log(`--- [ KẾT THÚC ] ---\n`);
        
    } catch (error) {
        console.error(`[logEvt] Lỗi khi xử lý sự kiện ${eventType}:`, error);
    }
};
