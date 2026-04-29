function UserList({ users }) {
  return (
    <div className="user-list">
      <h3>Online Users</h3>

      {users.length === 0 ? (
        <p>No users online</p>
      ) : (
        users.map((user) => (
          <div key={user.socketId} className="user-item">
            {user.username}
          </div>
        ))
      )}
    </div>
  );
}

export default UserList;
