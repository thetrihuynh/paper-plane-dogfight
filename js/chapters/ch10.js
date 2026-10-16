'use strict';
// Chương 10: Giông bão
WAVES.push(
{ title: 'Chương 10: Giông bão', story: 'Song Nhạn gãy cánh. Phe Đỏ dốc toàn bộ những chiếc còn lại, ẩn trong cơn giông. Lần đầu tiên, Phe Xanh là bên mạnh hơn.', sky: 'storm', wind: 1.6, spawn: [['stunt', 2], ['swallow', 3], ['nakamura', 2], ['glider', 1]],
    radio: [['Blackboard', 'Giông đang tới, gió giật cực mạnh. Giữ chắc cần lái!'], ['Phe Đỏ (bắt sóng)', 'Tháp vừa ra chỉ thị: gấp hết giấy còn lại! Giấy vụn, giấy rách, gì cũng được! Không để Phe Xanh tới được Dãy C!'],
            ['Alpha 2', 'Gió thế này, bật siêu thanh là cách thoát nhanh nhất!']],
    // winning, for once, and the three of them start to pull in different directions
    beats: [[5, [['Alpha 2', 'Chiếc vừa rơi... nếp cánh còn chưa kịp miết phẳng. Nó mới được gấp ra hôm qua thôi.'],
                 ['Alpha 3', 'Đừng nhìn xuống, Alpha 2. Lệnh là hạ hết.'],
                 ['Alpha 2', '...Dạo này cậu nói giống Blackboard quá đấy.']]],
            [2, [['Alpha 3', 'Hết trận này tôi sẽ xin vào xưởng gấp. Gấp một chiếc thật to, chở được cả ba đứa mình bay qua tường rào.'],
                 ['Alpha 2', 'Còn tôi thì muốn dạy mấy chiếc mới gấp bay. Bay cho vui thôi, không phải để bắn nhau.'],
                 ['Alpha 2', 'Alpha 1 thì chắc chỉ muốn bay cao hơn mây.']]],
            [1, [['Phe Đỏ (bắt sóng)', 'Hết rồi... Khu Tây chỉ còn lại một chiếc. Chỉ còn Red Eagle thôi.']]]],
    // before it starts, on a black screen
    interlude: { place: 'Thư Viện · trước cơn giông', mood: 'tension', lines: [
      ['Blackboard', 'Chỉ thị từ trên tháp: gấp thêm hai con Hạc nữa. Cùng con cũ là ba. Mỗi chiếc một quả, bay cùng một lúc.'],
      ['Alpha 2', 'Ba quả... để làm gì? Phòng Thí Nghiệm thành tro rồi mà.'],
      ['Blackboard', 'Lệnh nói: để kết thúc chiến tranh.'],
      ['Wingman', 'Một quả phá một toà nhà. Ba quả thì phá cả nửa sân trường.'],
      ['Wingman', 'Black. Nửa sân bên kia cũng có người gấp máy bay.'],
      ['Blackboard', '...Tôi biết.'],
      ['Blackboard', 'Tôi đã hỏi lại. Trên tháp không trả lời câu hỏi.'],
      ['Alpha 3', 'Nhưng xong chuyện này thì sẽ không còn ai phải rơi nữa, đúng không?'],
      [null, 'Không ai trả lời Alpha 3.']] } }
);
