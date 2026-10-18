// إعدادات Firebase وتوصيل قاعدة البيانات
const firebaseConfig = {
  apiKey: "AIzaSyAnhApcgqJakvQtBIwdeSfGxeZI1pStt3k",
  authDomain: "mr-nady.firebaseapp.com",
  databaseURL: "https://mr-nady-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "mr-nady",
  storageBucket: "mr-nady.firebasestorage.app",
  messagingSenderId: "653262497081",
  appId: "1:653262497081:web:851bfdf6a93d2775d6f4e8",
  measurementId: "G-LD29KC07GV"
};

// تهيئة التوصيل
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

// كلمة سر المستر الخفية
const ADMIN_MASTER_PASS = "1234";

let students = [];
let attendanceLogs = [];
let videos = [];
let currentStudent = null;
let selectedStudentForModal = null;

// الاستماع المباشر للتغيرات في Firebase
db.ref('students').on('value', snapshot => {
    const data = snapshot.val();
    students = data ? Object.values(data) : [];
    if (sessionStorage.getItem('isLoggedIn') === 'admin') {
        renderAdminStudents();
        populateStudentDropdown();
    }
}, error => {
    console.error("خطأ في الاتصال بقاعدة البيانات:", error);
});

db.ref('attendance').on('value', snapshot => {
    const data = snapshot.val();
    attendanceLogs = data ? Object.values(data) : [];
    if (sessionStorage.getItem('isLoggedIn') === 'admin') {
        renderAttendanceLogs();
    } else if (sessionStorage.getItem('isLoggedIn') === 'student') {
        renderStudentPersonalAttendance();
    }
});

db.ref('videos').on('value', snapshot => {
    const data = snapshot.val();
    videos = data ? Object.values(data) : [];
    if (sessionStorage.getItem('isLoggedIn') === 'admin') {
        renderAdminVideos();
    } else if (sessionStorage.getItem('isLoggedIn') === 'student') {
        renderStudentVideos();
    }
});

// تسجيل الدخول الموحد
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('unifiedLoginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const phone = document.getElementById('loginPhone').value.trim();
            const password = document.getElementById('loginPassword').value.trim();
            const errorMsg = document.getElementById('loginErrorMsg');

            if (password === ADMIN_MASTER_PASS) {
                sessionStorage.setItem('isLoggedIn', 'admin');
                document.getElementById('loginScreen').style.display = 'none';
                showAdminView();
                return;
            }

            const found = students.find(s => s.phone === phone && s.pass === password);
            if (found) {
                currentStudent = found;
                sessionStorage.setItem('isLoggedIn', 'student');
                sessionStorage.setItem('current_student_phone', phone);
                document.getElementById('loginScreen').style.display = 'none';
                showStudentView();
            } else {
                errorMsg.style.display = 'block';
            }
        });
    }

    // إضافة طالب جديد
    const addStudentForm = document.getElementById('addStudentForm');
    if (addStudentForm) {
        addStudentForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('stName').value.trim();
            const phone = document.getElementById('stPhone').value.trim();
            const parentPhone = document.getElementById('parentPhone').value.trim();
            const grade = document.getElementById('stGrade').value;
            const pass = document.getElementById('stPass').value.trim();

            const nextCodeNum = 1001 + students.length;
            const code = `STD-${nextCodeNum}`;
            const studentId = 'st_' + Date.now();

            const newStudent = {
                id: studentId,
                name, phone, parentPhone, grade, pass, code,
                isPaid: false
            };

            db.ref('students/' + studentId).set(newStudent)
                .then(() => {
                    addStudentForm.reset();
                    alert(`تم إضافة الطالب بنجاح!\nالكود الخاص به: ${code}`);
                })
                .catch((err) => {
                    alert("تعذر الحفظ في قاعدة البيانات. التأكد من إعدادات القواعد (Rules) في Firebase.\nالخطأ: " + err.message);
                });
        });
    }

    // تسجيل الحضور
    const markAttendanceForm = document.getElementById('markAttendanceForm');
    if (markAttendanceForm) {
        markAttendanceForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const studentCode = document.getElementById('selectStudent').value;
            const status = document.getElementById('attendanceStatus').value;
            const student = students.find(s => s.code === studentCode);
            if (!student) return;

            const logId = 'log_' + Date.now();
            const logData = {
                id: logId,
                studentCode: student.code,
                studentName: student.name,
                status,
                date: new Date().toLocaleString('ar-EG')
            };

            db.ref('attendance/' + logId).set(logData).then(() => {
                alert(`تم تسجيل حضور (${student.name}): ${status}`);
            });
        });
    }

    // إضافة فيديو
    const addVideoForm = document.getElementById('addVideoForm');
    if (addVideoForm) {
        addVideoForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const title = document.getElementById('vidTitle').value.trim();
            const url = document.getElementById('vidUrl').value.trim();
            const vidId = 'vid_' + Date.now();

            db.ref('videos/' + vidId).set({ id: vidId, title, url }).then(() => {
                addVideoForm.reset();
            });
        });
    }

    // فحص الجلسة السابقة
    const savedAuth = sessionStorage.getItem('isLoggedIn');
    if (savedAuth === 'admin') {
        document.getElementById('loginScreen').style.display = 'none';
        showAdminView();
    } else if (savedAuth === 'student') {
        const savedPhone = sessionStorage.getItem('current_student_phone');
        db.ref('students').once('value', snapshot => {
            const data = snapshot.val();
            students = data ? Object.values(data) : [];
            currentStudent = students.find(s => s.phone === savedPhone);
            if (currentStudent) {
                document.getElementById('loginScreen').style.display = 'none';
                showStudentView();
            }
        });
    }
});

function logout() {
    sessionStorage.clear();
    location.reload();
}
window.logout = logout;

function showAdminView() {
    document.getElementById('adminView').style.display = 'block';
    document.getElementById('studentView').style.display = 'none';
    renderAdminStudents();
    renderAttendanceLogs();
    renderAdminVideos();
    populateStudentDropdown();
}

function showStudentView() {
    document.getElementById('adminView').style.display = 'none';
    document.getElementById('studentView').style.display = 'block';

    const phone = sessionStorage.getItem('current_student_phone');
    currentStudent = students.find(s => s.phone === phone) || currentStudent;

    if (currentStudent) {
        document.getElementById('studentWelcomeName').innerText = currentStudent.name;
        document.getElementById('studentDisplayCode').innerText = currentStudent.code;
        document.getElementById('studentDisplayGrade').innerText = currentStudent.grade;

        const paidBadge = document.getElementById('studentDisplayPaid');
        if (currentStudent.isPaid) {
            paidBadge.className = 'badge-paid';
            paidBadge.innerText = 'تم دفع مصاريف الشهر ✓';
        } else {
            paidBadge.className = 'badge-unpaid';
            paidBadge.innerText = 'لم يتم دفع مصاريف الشهر ✗';
        }
    }

    renderStudentPersonalAttendance();
    renderStudentVideos();
}

function switchTab(tabId, e) {
    document.querySelectorAll('#adminView .section').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('#adminView .tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    if (e && e.currentTarget) e.currentTarget.classList.add('active');
}
window.switchTab = switchTab;

function renderAdminStudents() {
    const list = document.getElementById('adminStudentsList');
    if (!list) return;
    list.innerHTML = '';
    if (students.length === 0) {
        list.innerHTML = `<tr><td colspan="8" style="text-align:center;">لا توجد بيانات طلاب</td></tr>`;
        return;
    }

    students.forEach((st) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="code-badge">${st.code}</span></td>
            <td>${st.name}</td>
            <td>${st.grade}</td>
            <td>${st.phone}</td>
            <td>${st.parentPhone}</td>
            <td>
                <input type="text" value="${st.pass}" id="pass_${st.id}" style="width:90px; padding:4px;">
                <button class="action-btn" onclick="updateStudentPass('${st.id}')">تعديل</button>
            </td>
            <td><span class="${st.isPaid ? 'badge-paid' : 'badge-unpaid'}">${st.isPaid ? 'مدفوع' : 'غير مدفوع'}</span></td>
            <td>
                <button class="action-btn" onclick="openDetailsModal('${st.id}')">التفاصيل</button>
                <button class="delete-btn" onclick="deleteStudent('${st.id}')">🗑️</button>
            </td>
        `;
        list.appendChild(tr);
    });
}

function updateStudentPass(studentId) {
    const newPass = document.getElementById('pass_' + studentId).value.trim();
    if (!newPass) return alert('أدخل كلمة سر صحيحة');
    db.ref('students/' + studentId).update({ pass: newPass }).then(() => {
        alert('تم تحديث كلمة السر بنجاح');
    });
}
window.updateStudentPass = updateStudentPass;

function deleteStudent(studentId) {
    if (confirm('هل أنت متأكد من حذف هذا الطالب؟')) {
        db.ref('students/' + studentId).remove();
    }
}
window.deleteStudent = deleteStudent;

function openDetailsModal(studentId) {
    selectedStudentForModal = students.find(s => s.id === studentId);
    if (!selectedStudentForModal) return;

    document.getElementById('modalStudentName').innerText = selectedStudentForModal.name;

    const myLogs = attendanceLogs.filter(l => l.studentCode === selectedStudentForModal.code);
    const presentCount = myLogs.filter(l => l.status === 'حاضر').length;
    const absentCount = myLogs.filter(l => l.status === 'غائب').length;

    document.getElementById('modalStudentInfo').innerHTML = `
        <p><strong>الكود:</strong> ${selectedStudentForModal.code}</p>
        <p><strong>الصف:</strong> ${selectedStudentForModal.grade}</p>
        <p><strong>رقم الطالب:</strong> ${selectedStudentForModal.phone}</p>
        <p><strong>رقم ولي الأمر:</strong> ${selectedStudentForModal.parentPhone}</p>
        <p><strong>عدد مرات الحضور:</strong> <span style="color:var(--primary); font-weight:bold;">${presentCount}</span></p>
        <p><strong>عدد مرات الغياب:</strong> <span style="color:var(--danger); font-weight:bold;">${absentCount}</span></p>
    `;

    document.getElementById('modalPaidStatus').value = selectedStudentForModal.isPaid ? "true" : "false";
    document.getElementById('detailsModal').style.display = 'flex';
}
window.openDetailsModal = openDetailsModal;

function closeDetailsModal() {
    document.getElementById('detailsModal').style.display = 'none';
}
window.closeDetailsModal = closeDetailsModal;

function updatePaymentStatus(val) {
    if (!selectedStudentForModal) return;
    const isPaid = val === "true";
    db.ref('students/' + selectedStudentForModal.id).update({ isPaid }).then(() => {
        selectedStudentForModal.isPaid = isPaid;
        alert('تم تحديث حالة المصاريف بنجاح');
    });
}
window.updatePaymentStatus = updatePaymentStatus;

function populateStudentDropdown() {
    const select = document.getElementById('selectStudent');
    if (!select) return;
    select.innerHTML = `<option value="">-- اختر الطالب --</option>`;
    students.forEach(st => {
        const opt = document.createElement('option');
        opt.value = st.code;
        opt.textContent = `${st.name} (${st.grade} - ${st.code})`;
        select.appendChild(opt);
    });
}

function renderAttendanceLogs() {
    const list = document.getElementById('attendanceLogsList');
    if (!list) return;
    list.innerHTML = '';
    if (attendanceLogs.length === 0) {
        list.innerHTML = `<tr><td colspan="6" style="text-align:center;">لا توجد سجلات حضور</td></tr>`;
        return;
    }

    attendanceLogs.forEach((log) => {
        const st = students.find(s => s.code === log.studentCode);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="code-badge">${log.studentCode}</span></td>
            <td>${log.studentName}</td>
            <td><span class="${log.status === 'حاضر' ? 'badge-present' : 'badge-absent'}">${log.status}</span></td>
            <td>${log.date}</td>
            <td>${st ? `<button class="action-btn" onclick="openDetailsModal('${st.id}')">التفاصيل</button>` : '-'}</td>
            <td><button class="delete-btn" onclick="deleteLog('${log.id}')">🗑️</button></td>
        `;
        list.appendChild(tr);
    });
}

function deleteLog(logId) {
    db.ref('attendance/' + logId).remove();
}
window.deleteLog = deleteLog;

function renderStudentPersonalAttendance() {
    const list = document.getElementById('studentPersonalAttendance');
    if (!list) return;
    list.innerHTML = '';
    if (!currentStudent) return;

    const myLogs = attendanceLogs.filter(l => l.studentCode === currentStudent.code);
    if (myLogs.length === 0) {
        list.innerHTML = `<tr><td colspan="2" style="text-align:center;">لا توجد سجلات حضور مسجلة لك</td></tr>`;
        return;
    }

    myLogs.forEach(log => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${log.date}</td>
            <td><span class="${log.status === 'حاضر' ? 'badge-present' : 'badge-absent'}">${log.status}</span></td>
        `;
        list.appendChild(tr);
    });
}

function renderAdminVideos() {
    const grid = document.getElementById('adminVideoGrid');
    if (!grid) return;
    grid.innerHTML = '';
    if (videos.length === 0) {
        grid.innerHTML = `<p style="grid-column:1/-1; text-align:center; color:var(--text-muted);">لا توجد فيديوهات</p>`;
        return;
    }

    videos.forEach(vid => {
        let embedUrl = vid.url.includes('watch?v=') ? vid.url.replace('watch?v=', 'embed/') : vid.url;
        if (vid.url.includes('youtu.be/')) embedUrl = vid.url.replace('youtu.be/', 'www.youtube.com/embed/');

        const card = document.createElement('div');
        card.className = 'video-card';
        card.innerHTML = `
            <iframe src="${embedUrl}" allowfullscreen></iframe>
            <div class="video-info">
                <h3>${vid.title}</h3>
                <button class="delete-btn" style="font-size:0.85rem; margin-top:5px;" onclick="deleteVideo('${vid.id}')">حذف الفيديو 🗑️</button>
            </div>
        `;
        grid.appendChild(card);
    });
}

function renderStudentVideos() {
    const grid = document.getElementById('studentVideoGrid');
    if (!grid) return;
    grid.innerHTML = '';
    if (videos.length === 0) {
        grid.innerHTML = `<p style="grid-column:1/-1; text-align:center; color:var(--text-muted);">لا توجد فيديوهات متاحة حالياً</p>`;
        return;
    }

    videos.forEach(vid => {
        let embedUrl = vid.url.includes('watch?v=') ? vid.url.replace('watch?v=', 'embed/') : vid.url;
        if (vid.url.includes('youtu.be/')) embedUrl = vid.url.replace('youtu.be/', 'www.youtube.com/embed/');

        const card = document.createElement('div');
        card.className = 'video-card';
        card.innerHTML = `
            <iframe src="${embedUrl}" allowfullscreen></iframe>
            <div class="video-info">
                <h3>${vid.title}</h3>
            </div>
        `;
        grid.appendChild(card);
    });
}

function deleteVideo(vidId) {
    db.ref('videos/' + vidId).remove();
}
window.deleteVideo = deleteVideo;
