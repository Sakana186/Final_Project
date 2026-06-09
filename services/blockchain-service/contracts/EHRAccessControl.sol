// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract EHRAccessControl {
    enum Role {
        NONE,
        PATIENT,
        DOCTOR,
        ADMIN
    }

    struct UserInfo {
        address userAddress;
        Role role;
        bytes32 attributeHash;
        bool isActive;
    }

    struct RecordMetadata {
        uint256 recordId;
        address patient;
        address creator;
        string cid;
        bytes32 recordHash;
        bytes32 policyHash;
        uint256 createdAt;
        uint256 updatedAt;
        bool isActive;
    }

    struct AccessPermission {
        bool granted;
        uint256 expiredAt;
        bytes32 purposeHash;
    }

    address public owner;
    uint256 public nextRecordId;

    mapping(address => UserInfo) public users;
    mapping(uint256 => RecordMetadata) public records;
    mapping(uint256 => mapping(address => AccessPermission)) public permissions;

    event UserRegistered(address indexed user, Role role);
    event UserStatusUpdated(address indexed user, bool isActive);
    event RecordAdded(
        uint256 indexed recordId,
        address indexed patient,
        address indexed creator,
        string cid,
        bytes32 recordHash,
        bytes32 policyHash
    );
    event AccessRequested(
        uint256 indexed recordId,
        address indexed requester,
        uint256 expiredAt,
        bytes32 purposeHash
    );
    event AccessGranted(
        uint256 indexed recordId,
        address indexed grantee,
        uint256 expiredAt,
        bytes32 purposeHash
    );
    event AccessRevoked(
        uint256 indexed recordId,
        address indexed grantee
    );
    event RecordAccessLogged(
        uint256 indexed recordId,
        address indexed user,
        uint256 accessedAt
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyDoctor() {
        require(users[msg.sender].role == Role.DOCTOR, "Not doctor");
        require(users[msg.sender].isActive, "Inactive doctor");
        _;
    }

    constructor() {
        owner = msg.sender;
        users[msg.sender] = UserInfo(msg.sender, Role.ADMIN, bytes32(0), true);
    }

    function registerUser(
        address user,
        Role role,
        bytes32 attributeHash
    ) external onlyOwner {
        users[user] = UserInfo(user, role, attributeHash, true);
        emit UserRegistered(user, role);
    }

    function setUserStatus(address user, bool isActive) external onlyOwner {
        require(users[user].role != Role.NONE, "User not registered");
        users[user].isActive = isActive;
        emit UserStatusUpdated(user, isActive);
    }

    function addRecord(
        address patient,
        string memory cid,
        bytes32 recordHash,
        bytes32 policyHash
    ) external onlyDoctor returns (uint256) {
        uint256 recordId = nextRecordId;

        records[recordId] = RecordMetadata({
            recordId: recordId,
            patient: patient,
            creator: msg.sender,
            cid: cid,
            recordHash: recordHash,
            policyHash: policyHash,
            createdAt: block.timestamp,
            updatedAt: block.timestamp,
            isActive: true
        });

        permissions[recordId][patient] = AccessPermission(true, type(uint256).max, bytes32(0));
        permissions[recordId][msg.sender] = AccessPermission(true, type(uint256).max, bytes32(0));

        emit RecordAdded(recordId, patient, msg.sender, cid, recordHash, policyHash);
        nextRecordId++;
        return recordId;
    }

    function requestAccess(
        uint256 recordId,
        uint256 expiredAt,
        bytes32 purposeHash
    ) external {
        require(records[recordId].isActive, "Record inactive");
        require(users[msg.sender].role != Role.NONE, "User not registered");
        require(users[msg.sender].isActive, "Inactive user");

        emit AccessRequested(recordId, msg.sender, expiredAt, purposeHash);
    }

    function grantAccess(
        uint256 recordId,
        address grantee,
        uint256 expiredAt,
        bytes32 purposeHash
    ) external {
        require(
            records[recordId].patient == msg.sender || msg.sender == owner,
            "Not allowed"
        );

        permissions[recordId][grantee] = AccessPermission(true, expiredAt, purposeHash);

        emit AccessGranted(recordId, grantee, expiredAt, purposeHash);
    }

    function revokeAccess(uint256 recordId, address grantee) external {
        require(
            records[recordId].patient == msg.sender || msg.sender == owner,
            "Not allowed"
        );

        permissions[recordId][grantee].granted = false;

        emit AccessRevoked(recordId, grantee);
    }

    function hasAccess(uint256 recordId, address user) public view returns (bool) {
        AccessPermission memory p = permissions[recordId][user];

        if (!p.granted) {
            return false;
        }

        if (p.expiredAt < block.timestamp) {
            return false;
        }

        return true;
    }

    function logAccess(uint256 recordId) external {
        require(hasAccess(recordId, msg.sender), "No access");
        emit RecordAccessLogged(recordId, msg.sender, block.timestamp);
    }

    function getRecordMetadata(uint256 recordId) external view returns (RecordMetadata memory) {
        require(hasAccess(recordId, msg.sender), "No access");
        return records[recordId];
    }
}
