// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Minimal patient-centric consent registry for encrypted off-chain health records.
///         Stores only pointers + hashes + encrypted DEKs (no PHI).
contract HealthRecordsConsent {
    struct RecordMeta {
        address patient; // data subject / controller in this model
        address uploader; // provider/lab/hospital that uploaded
        string cid; // IPFS CID for encrypted payload
        bytes32 dataHash; // hash of encrypted payload (integrity)
        bytes32 recordType; // e.g., keccak256("LAB_RESULT")
        uint64 createdAt;
    }

    struct Consent {
        bool active;
        uint64 expiresAt; // 0 = no expiry
    }

    uint256 public nextRecordId = 1;

    mapping(uint256 => RecordMeta) private records;
    mapping(address => uint256[]) private recordsByPatient;
    mapping(address => uint256[]) private recordsByViewer;

    // recordId => viewer => consent
    mapping(uint256 => mapping(address => Consent)) private consentByRecord;

    // recordId => viewer => encrypted DEK for that viewer (wallet encryption key)
    mapping(uint256 => mapping(address => bytes)) private encryptedDEKByRecord;

    event RecordAdded(
        uint256 indexed recordId,
        address indexed patient,
        address indexed uploader,
        bytes32 recordType,
        bytes32 dataHash,
        string cid
    );

    event ConsentGranted(uint256 indexed recordId, address indexed patient, address indexed viewer, uint64 expiresAt);
    event ConsentRevoked(uint256 indexed recordId, address indexed patient, address indexed viewer);
    event EncryptedDEKSet(uint256 indexed recordId, address indexed patient, address indexed viewer);

    modifier onlyPatient(uint256 recordId) {
        require(records[recordId].patient == msg.sender, "NOT_PATIENT");
        _;
    }

    function addRecord(
        address patient,
        string calldata cid,
        bytes32 dataHash,
        bytes32 recordType,
        bytes calldata encryptedDEKForPatient
    ) external returns (uint256 recordId) {
        require(patient != address(0), "BAD_PATIENT");
        require(bytes(cid).length > 0, "BAD_CID");
        require(dataHash != bytes32(0), "BAD_HASH");

        recordId = nextRecordId++;
        records[recordId] = RecordMeta({
            patient: patient,
            uploader: msg.sender,
            cid: cid,
            dataHash: dataHash,
            recordType: recordType,
            createdAt: uint64(block.timestamp)
        });

        recordsByPatient[patient].push(recordId);

        // Patient can always view; store encrypted DEK for patient and mark consent active.
        consentByRecord[recordId][patient] = Consent({active: true, expiresAt: 0});
        encryptedDEKByRecord[recordId][patient] = encryptedDEKForPatient;
        recordsByViewer[patient].push(recordId);

        emit RecordAdded(recordId, patient, msg.sender, recordType, dataHash, cid);
        emit ConsentGranted(recordId, patient, patient, 0);
        emit EncryptedDEKSet(recordId, patient, patient);
    }

    function grantAccess(
        uint256 recordId,
        address viewer,
        bytes calldata encryptedDEKForViewer,
        uint64 expiresAt
    ) external onlyPatient(recordId) {
        require(viewer != address(0), "BAD_VIEWER");
        require(encryptedDEKForViewer.length > 0, "BAD_EDEK");
        require(viewer != records[recordId].patient, "USE_PATIENT_VIEW");

        // If expiry is set, it must be in the future.
        if (expiresAt != 0) {
            require(expiresAt > uint64(block.timestamp), "BAD_EXPIRY");
        }

        Consent storage c = consentByRecord[recordId][viewer];
        bool wasActive = c.active;
        c.active = true;
        c.expiresAt = expiresAt;

        encryptedDEKByRecord[recordId][viewer] = encryptedDEKForViewer;

        // Only push to viewer index the first time they get access.
        if (!wasActive) {
            recordsByViewer[viewer].push(recordId);
        }

        emit ConsentGranted(recordId, msg.sender, viewer, expiresAt);
        emit EncryptedDEKSet(recordId, msg.sender, viewer);
    }

    function revokeAccess(uint256 recordId, address viewer) external onlyPatient(recordId) {
        Consent storage c = consentByRecord[recordId][viewer];
        require(c.active, "NOT_ACTIVE");
        c.active = false;
        c.expiresAt = 0;
        delete encryptedDEKByRecord[recordId][viewer];
        emit ConsentRevoked(recordId, msg.sender, viewer);
    }

    function canView(uint256 recordId, address viewer) public view returns (bool) {
        Consent memory c = consentByRecord[recordId][viewer];
        if (!c.active) return false;
        if (c.expiresAt == 0) return true;
        return c.expiresAt > uint64(block.timestamp);
    }

    function getRecord(uint256 recordId) external view returns (RecordMeta memory) {
        require(records[recordId].patient != address(0), "NO_RECORD");
        return records[recordId];
    }

    function getEncryptedDEK(uint256 recordId) external view returns (bytes memory) {
        require(canView(recordId, msg.sender), "NO_CONSENT");
        return encryptedDEKByRecord[recordId][msg.sender];
    }

    function getMyPatientRecordIds() external view returns (uint256[] memory) {
        return recordsByPatient[msg.sender];
    }

    function getMyViewerRecordIds() external view returns (uint256[] memory) {
        return recordsByViewer[msg.sender];
    }
}

